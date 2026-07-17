import { getSafeFromBlock } from "@/lib/blockRange";

export const VISIT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_VISIT_REGISTRY_ADDRESS;

export const VISIT_REGISTRY_ABI = [
  "function requestVisit(address patient) returns (uint256)",
  "function assignDoctor(uint256 visitId, address doctor)",
  "function approveVisit(uint256 visitId)",
  "function cancelVisit(uint256 visitId)",
  "function getVisitsOfPatient(address patient) view returns (uint256[])",
  "function visits(uint256) view returns (uint256 id, address patient, address hospital, address assignedDoctor, uint8 status, uint256 requestedAt, uint256 checkedInAt)",
  "event VisitRequested(uint256 indexed id, address indexed patient, address indexed hospital)",
  "event VisitDoctorAssigned(uint256 indexed id, address indexed doctor)",
  "event VisitApproved(uint256 indexed id)",
  "event VisitCancelled(uint256 indexed id)",
];

// Mirror VisitRegistry.sol's enum — index === on-chain uint8 value.
export const VISIT_STATUS = ["Requested", "CheckedIn", "Cancelled"];

export function visitStatusLabel(status) {
  return VISIT_STATUS[status] ?? "Unknown";
}

async function loadVisits(visitRegistry, ids) {
  const rows = await Promise.all(ids.map((id) => visitRegistry.visits(id)));
  return rows.map((v) => ({
    id: v.id.toNumber(),
    patient: v.patient,
    hospital: v.hospital,
    assignedDoctor: v.assignedDoctor,
    status: v.status,
    requestedAt: v.requestedAt.toNumber(),
    checkedInAt: v.checkedInAt.toNumber(),
  }));
}

export async function loadVisitsForPatient(visitRegistry, patientAddress) {
  const ids = await visitRegistry.getVisitsOfPatient(patientAddress);
  return loadVisits(visitRegistry, ids);
}

// There's no on-chain "visits by hospital" index — hospitals find their own
// via the VisitRequested event log, same event-log-then-recheck pattern used
// throughout this app (see lib/identityRegistry.js's affiliation-request loader).
export async function loadVisitsForHospital(visitRegistry, hospitalAddress) {
  const fromBlock = await getSafeFromBlock(visitRegistry.provider);
  // VisitRequested(id, patient, hospital) — hospital is the *third* indexed
  // arg, not the second. Passing hospitalAddress as the second positional
  // filter arg silently filtered by patient === hospitalAddress instead,
  // which is never true, so this always returned zero results.
  const filter = visitRegistry.filters.VisitRequested(null, null, hospitalAddress);
  const logs = await visitRegistry.queryFilter(filter, fromBlock);
  const ids = logs.map((log) => log.args.id.toNumber());
  return loadVisits(visitRegistry, ids);
}

// Same approach for "visits currently assigned to me" on the Doctor dashboard.
export async function loadVisitsAssignedToDoctor(visitRegistry, doctorAddress) {
  const fromBlock = await getSafeFromBlock(visitRegistry.provider);
  const filter = visitRegistry.filters.VisitDoctorAssigned(null, doctorAddress);
  const logs = await visitRegistry.queryFilter(filter, fromBlock);
  const ids = [...new Set(logs.map((log) => log.args.id.toNumber()))];
  const all = await loadVisits(visitRegistry, ids);
  // Re-check current assignment — a visit can be reassigned to someone else later.
  return all.filter((v) => v.assignedDoctor.toLowerCase() === doctorAddress.toLowerCase());
}
