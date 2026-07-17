import { getSafeFromBlock, queryFilterChunked } from "@/lib/blockRange";

export const IDENTITY_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS;

export const IDENTITY_REGISTRY_ABI = [
  "function register(uint8 role, string memory name, string memory organization, string memory phone, string memory idNumber)",
  "function setPublicKey(bytes32 publicKey)",
  "function roleOf(address account) view returns (uint8)",
  "function isRegistered(address account) view returns (bool)",
  "function publicKeyOf(address account) view returns (bytes32)",
  "function requestHospitalAffiliation(address hospital)",
  "function confirmHospitalAffiliation(address doctor)",
  "function profiles(address) view returns (uint8 role, string name, string organization, string phone, string idNumber, bytes32 publicKey, address hospital, bool registered)",
  "event Registered(address indexed account, uint8 role, string name)",
  "event PublicKeySet(address indexed account, bytes32 publicKey)",
  "event HospitalAffiliationRequested(address indexed doctor, address indexed hospital)",
  "event HospitalAffiliationConfirmed(address indexed doctor, address indexed hospital)",
];

// Mirrors IdentityRegistry.sol's `enum Role`. Index === on-chain uint8 value.
export const ROLES = ["None", "Patient", "Doctor", "Hospital", "Laboratory", "Pharmacy", "Insurer"];

export const ROLE = Object.fromEntries(ROLES.map((name, index) => [name, index]));

export function roleLabel(roleIndex) {
  return ROLES[roleIndex] ?? "Unknown";
}

// The routes each role lands on post-connect, e.g. Role.Patient -> "patient".
export function roleSlug(roleIndex) {
  return roleLabel(roleIndex).toLowerCase();
}

// There's no on-chain "requests for this hospital" list — find every doctor
// who has ever called requestHospitalAffiliation(hospital) via the event
// log, then keep only those whose profile.hospital isn't already this
// hospital (i.e. not yet confirmed).
export async function loadPendingAffiliationRequests(identityRegistry, hospitalAddress) {
  const fromBlock = await getSafeFromBlock(identityRegistry.provider);
  const filter = identityRegistry.filters.HospitalAffiliationRequested(null, hospitalAddress);
  const logs = await queryFilterChunked(identityRegistry, filter, fromBlock);
  const uniqueDoctors = [...new Set(logs.map((log) => log.args.doctor))];

  const pending = [];
  for (const doctor of uniqueDoctors) {
    const profile = await identityRegistry.profiles(doctor);
    if (profile.hospital.toLowerCase() !== hospitalAddress.toLowerCase()) {
      pending.push({
        doctor,
        doctorName: profile.name,
        doctorPhone: profile.phone,
        doctorLicense: profile.idNumber,
      });
    }
  }
  return pending;
}

// Same event-log-then-recheck approach, but for doctors whose affiliation
// has already been confirmed — backs the Hospital dashboard's "Affiliated
// Doctors" roster, used both as a directory and as the source list for
// assigning a checked-in patient to one of the hospital's own doctors.
export async function loadConfirmedDoctorsForHospital(identityRegistry, hospitalAddress) {
  const fromBlock = await getSafeFromBlock(identityRegistry.provider);
  const filter = identityRegistry.filters.HospitalAffiliationConfirmed(null, hospitalAddress);
  const logs = await queryFilterChunked(identityRegistry, filter, fromBlock);
  const uniqueDoctors = [...new Set(logs.map((log) => log.args.doctor))];

  const confirmed = [];
  for (const doctor of uniqueDoctors) {
    const profile = await identityRegistry.profiles(doctor);
    if (profile.hospital.toLowerCase() === hospitalAddress.toLowerCase()) {
      confirmed.push({
        doctor,
        doctorName: profile.name,
        doctorPhone: profile.phone,
        doctorLicense: profile.idNumber,
      });
    }
  }
  return confirmed;
}
