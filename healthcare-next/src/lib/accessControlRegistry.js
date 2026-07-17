import { getSafeFromBlock, queryFilterChunked } from "@/lib/blockRange";

export const ACCESS_CONTROL_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_ACCESS_CONTROL_REGISTRY_ADDRESS;

export const ACCESS_CONTROL_REGISTRY_ABI = [
  "function requestAccess(address patient)",
  "function approveAccess(address doctor, uint8 duration)",
  "function denyAccess(address doctor)",
  "function revokeAccess(address doctor)",
  "function hasAccess(address patient, address doctor) view returns (bool)",
  "function grants(address, address) view returns (uint8 status, uint256 expiresAt, uint256 requestedAt)",
  "event AccessRequested(address indexed patient, address indexed doctor)",
  "event AccessApproved(address indexed patient, address indexed doctor, uint256 expiresAt)",
  "event AccessDenied(address indexed patient, address indexed doctor)",
  "event AccessRevoked(address indexed patient, address indexed doctor)",
];

// Mirror AccessControlRegistry.sol's enums — index === on-chain uint8 value.
export const GRANT_STATUS = ["None", "Pending", "Approved", "Denied", "Revoked"];
export const DURATION = { OneDay: 0, OneWeek: 1, OneMonth: 2 };

export const DURATION_OPTIONS = [
  { value: DURATION.OneDay, label: "24 Hours" },
  { value: DURATION.OneWeek, label: "7 Days" },
  { value: DURATION.OneMonth, label: "30 Days" },
];

export function grantStatusLabel(status) {
  return GRANT_STATUS[status] ?? "Unknown";
}

// There's no on-chain "list of pending requests for a patient" getter —
// grants is keyed patient=>provider=>Grant, not iterable. So we find every
// provider (a Doctor or a Pharmacy — requestAccess accepts either) who has
// ever called requestAccess(patient) via the event log, then re-check each
// one's *current* grants() status, since a later approve/deny/revoke may
// have already resolved it. `role` is resolved so the UI can label each
// request "Doctor" or "Pharmacy" instead of assuming one or the other.
export async function loadPendingRequestsForPatient(accessControl, identityRegistry, patientAddress) {
  const fromBlock = await getSafeFromBlock(accessControl.provider);
  const filter = accessControl.filters.AccessRequested(patientAddress);
  const logs = await queryFilterChunked(accessControl, filter, fromBlock);
  const uniqueProviders = [...new Set(logs.map((log) => log.args.doctor))];

  const pending = [];
  for (const provider of uniqueProviders) {
    const grant = await accessControl.grants(patientAddress, provider);
    if (grant.status === 1) {
      const profile = await identityRegistry.profiles(provider);
      pending.push({ provider, providerName: profile.name, role: profile.role });
    }
  }
  return pending;
}

// Same event-log-then-recheck approach as loadPendingRequestsForPatient, but
// surfaces providers with a *currently unexpired Approved* grant instead —
// this backs the patient's "Manage Access" / revoke list.
export async function loadApprovedGrantsForPatient(accessControl, identityRegistry, patientAddress) {
  const fromBlock = await getSafeFromBlock(accessControl.provider);
  const filter = accessControl.filters.AccessRequested(patientAddress);
  const logs = await queryFilterChunked(accessControl, filter, fromBlock);
  const uniqueProviders = [...new Set(logs.map((log) => log.args.doctor))];

  const approved = [];
  for (const provider of uniqueProviders) {
    const hasAccess = await accessControl.hasAccess(patientAddress, provider);
    if (hasAccess) {
      const grant = await accessControl.grants(patientAddress, provider);
      const profile = await identityRegistry.profiles(provider);
      approved.push({ provider, providerName: profile.name, role: profile.role, expiresAt: grant.expiresAt.toNumber() });
    }
  }
  return approved;
}

// The doctor-side mirror of loadApprovedGrantsForPatient — every patient who
// has ever approved this doctor, re-checked for a *currently unexpired*
// grant. Deliberately derived from the on-chain AccessApproved event (indexed
// by both patient and doctor) rather than cached client-side: this way the
// list is correct from any browser/device the doctor connects from, and can
// never show a patient who has since revoked or let access expire.
export async function loadApprovedPatientsForDoctor(accessControl, identityRegistry, doctorAddress) {
  const fromBlock = await getSafeFromBlock(accessControl.provider);
  const filter = accessControl.filters.AccessApproved(null, doctorAddress);
  const logs = await queryFilterChunked(accessControl, filter, fromBlock);
  const uniquePatients = [...new Set(logs.map((log) => log.args.patient))];

  const approved = [];
  for (const patient of uniquePatients) {
    const hasAccess = await accessControl.hasAccess(patient, doctorAddress);
    if (hasAccess) {
      const grant = await accessControl.grants(patient, doctorAddress);
      const profile = await identityRegistry.profiles(patient);
      approved.push({ address: patient, name: profile.name, expiresAt: grant.expiresAt.toNumber() });
    }
  }
  return approved;
}
