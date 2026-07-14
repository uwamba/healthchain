export const CLAIM_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_CLAIM_REGISTRY_ADDRESS;

export const CLAIM_REGISTRY_ABI = [
  "function submitClaim(address patient, address insurer, uint256[] memory recordIds, string memory description, uint256 amount) returns (uint256)",
  "function approvePatientVisibility(uint256 claimId)",
  "function denyPatientVisibility(uint256 claimId)",
  "function approveClaim(uint256 claimId)",
  "function rejectClaim(uint256 claimId)",
  "function hasFullVisibility(uint256 claimId) view returns (bool)",
  "function requestVisibilityRenewal(uint256 claimId)",
  "function approveVisibilityRenewal(uint256 claimId)",
  "function recordClaimed(uint256) view returns (bool)",
  "function getClaimsForPatient(address) view returns (uint256[])",
  "function getClaimsForProvider(address) view returns (uint256[])",
  "function getClaimsForInsurer(address) view returns (uint256[])",
  "function getClaimRecordIds(uint256 claimId) view returns (uint256[])",
  "function claims(uint256) view returns (uint256 id, address patient, address provider, address insurer, string description, uint256 amount, uint8 status, uint256 createdAt, uint256 visibilityExpiresAt)",
  "event ClaimSubmitted(uint256 indexed id, address indexed patient, address indexed provider, address insurer, uint256 amount)",
  "event ClaimPatientApproved(uint256 indexed id, uint256 visibilityExpiresAt)",
  "event ClaimPatientDenied(uint256 indexed id)",
  "event ClaimApproved(uint256 indexed id)",
  "event ClaimRejected(uint256 indexed id)",
  "event VisibilityRenewalRequested(uint256 indexed id, address indexed requester)",
  "event VisibilityRenewed(uint256 indexed id, uint256 visibilityExpiresAt)",
];

import { getSafeFromBlock } from "@/lib/blockRange";

// Mirror ClaimRegistry.sol's enum — index === on-chain uint8 value.
export const CLAIM_STATUS = ["AwaitingPatientApproval", "Pending", "Approved", "Rejected", "PatientDenied"];

export function claimStatusLabel(status) {
  return CLAIM_STATUS[status] ?? "Unknown";
}

// Fetches everything a claim has to offer — description, recordIds, the
// works. Fine for the patient's own dashboard and the provider that filed
// it (neither is the third party this project's visibility window is about);
// it's only the *insurer's* view that needs to fall back to a stub once
// hasFullVisibility lapses — see loadClaimsForInsurer below.
async function loadClaims(claimRegistry, ids) {
  const rows = await Promise.all(
    ids.map(async (id) => {
      const c = await claimRegistry.claims(id);
      const hasFullVisibility = await claimRegistry.hasFullVisibility(id);
      const recordIds = await claimRegistry.getClaimRecordIds(id);
      return {
        id: c.id.toNumber(),
        patient: c.patient,
        provider: c.provider,
        insurer: c.insurer,
        description: c.description,
        amount: c.amount.toNumber(),
        status: c.status,
        createdAt: c.createdAt.toNumber(),
        visibilityExpiresAt: c.visibilityExpiresAt.toNumber(),
        hasFullVisibility,
        recordIds: recordIds.map((r) => r.toNumber()),
      };
    })
  );
  return rows;
}

export async function loadClaimsForPatient(claimRegistry, patientAddress) {
  const ids = await claimRegistry.getClaimsForPatient(patientAddress);
  return loadClaims(claimRegistry, ids);
}

export async function loadClaimsForProvider(claimRegistry, providerAddress) {
  const ids = await claimRegistry.getClaimsForProvider(providerAddress);
  return loadClaims(claimRegistry, ids);
}

// Once `hasFullVisibility` lapses (30 days after the patient's last
// approval/renewal), the description and attached recordIds are blanked out
// here — a frontend policy gate, not encryption (the raw data is still
// readable via a direct contract call, same documented limitation as every
// other "gated" view in this app). Only this insurer-facing loader applies
// the gate; the patient/provider's own views (above) always see everything.
export async function loadClaimsForInsurer(claimRegistry, insurerAddress) {
  const ids = await claimRegistry.getClaimsForInsurer(insurerAddress);
  const rows = await loadClaims(claimRegistry, ids);
  return rows.map((claim) =>
    claim.hasFullVisibility ? claim : { ...claim, description: "", recordIds: [] }
  );
}

// Event-log-then-recheck: finds every claim where this claim's provider or
// insurer has asked the patient to renew visibility, keeping only the ones
// still actually expired (a renewal may have already happened since).
export async function loadVisibilityRenewalRequestsForPatient(claimRegistry, patientClaims) {
  const stillExpired = patientClaims.filter((c) => !c.hasFullVisibility && c.status !== 0 && c.status !== 4);
  if (stillExpired.length === 0) return [];

  const fromBlock = await getSafeFromBlock(claimRegistry.provider);
  const filter = claimRegistry.filters.VisibilityRenewalRequested();
  const logs = await claimRegistry.queryFilter(filter, fromBlock);
  const requestedIds = new Set(logs.map((log) => log.args.id.toNumber()));

  return stillExpired.filter((c) => requestedIds.has(c.id));
}

// Cross-checks each attached record against MedicalRecordRegistry — "blockchain
// validity" in the Insurance dashboard is this check, not a new contract state
// (see docs/ARCHITECTURE.md's audit-trail reasoning for the same principle).
export async function checkClaimRecordsValid(medicalRecordRegistry, claim) {
  const records = await Promise.all(claim.recordIds.map((id) => medicalRecordRegistry.records(id)));
  return records.every((r) => r.patient.toLowerCase() === claim.patient.toLowerCase() && r.status !== 2);
}
