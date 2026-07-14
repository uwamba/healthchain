import { getSafeFromBlock } from "@/lib/blockRange";

export const REFERRAL_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REFERRAL_REGISTRY_ADDRESS;

export const REFERRAL_REGISTRY_ABI = [
  "function createReferral(address patient, address provider, string memory reason) returns (uint256)",
  "function approveReferral(uint256 referralId)",
  "function denyReferral(uint256 referralId)",
  "function completeReferral(uint256 referralId, uint256 recordId)",
  "function approveReferralResult(uint256 referralId)",
  "function getReferralsOfPatient(address patient) view returns (uint256[])",
  "function referrals(uint256) view returns (uint256 id, address patient, address referringDoctor, address provider, string reason, uint8 status, uint256 resultRecordId, uint256 createdAt)",
  "event ReferralRequested(uint256 indexed id, address indexed referringDoctor, address indexed provider, address patient)",
  "event ReferralApproved(uint256 indexed id)",
  "event ReferralDenied(uint256 indexed id)",
  "event ReferralCompleted(uint256 indexed id, uint256 recordId)",
  "event ReferralResultApproved(uint256 indexed id)",
];

// Mirror ReferralRegistry.sol's enum — index === on-chain uint8 value.
export const REFERRAL_STATUS = ["Requested", "Approved", "Denied", "Completed", "ResultApproved"];

export function referralStatusLabel(status) {
  return REFERRAL_STATUS[status] ?? "Unknown";
}

async function loadReferrals(referralRegistry, ids) {
  const rows = await Promise.all(ids.map((id) => referralRegistry.referrals(id)));
  return rows.map((r) => ({
    id: r.id.toNumber(),
    patient: r.patient,
    referringDoctor: r.referringDoctor,
    provider: r.provider,
    reason: r.reason,
    status: r.status,
    resultRecordId: r.resultRecordId.toNumber(),
    createdAt: r.createdAt.toNumber(),
  }));
}

export async function loadReferralsForPatient(referralRegistry, patientAddress) {
  const ids = await referralRegistry.getReferralsOfPatient(patientAddress);
  return loadReferrals(referralRegistry, ids);
}

// No on-chain "referrals by provider/doctor" index — same event-log-then-recheck
// pattern used throughout this app (referringDoctor and provider are both
// indexed on ReferralRequested specifically so these two lookups work).
export async function loadReferralsForProvider(referralRegistry, providerAddress) {
  const fromBlock = await getSafeFromBlock(referralRegistry.provider);
  const filter = referralRegistry.filters.ReferralRequested(null, null, providerAddress);
  const logs = await referralRegistry.queryFilter(filter, fromBlock);
  const ids = logs.map((log) => log.args.id.toNumber());
  return loadReferrals(referralRegistry, ids);
}

export async function loadReferralsForDoctor(referralRegistry, doctorAddress) {
  const fromBlock = await getSafeFromBlock(referralRegistry.provider);
  const filter = referralRegistry.filters.ReferralRequested(null, doctorAddress);
  const logs = await referralRegistry.queryFilter(filter, fromBlock);
  const ids = logs.map((log) => log.args.id.toNumber());
  return loadReferrals(referralRegistry, ids);
}
