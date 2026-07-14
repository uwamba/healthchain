import { getSafeFromBlock } from "@/lib/blockRange";

export const MEDICAL_RECORD_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_MEDICAL_RECORD_REGISTRY_ADDRESS;

export const MEDICAL_RECORD_REGISTRY_ABI = [
  "function createRecord(address patient, uint8 recordType, string memory ipfsCid) returns (uint256)",
  "function dispensePrescription(uint256 recordId)",
  "function revokeRecord(uint256 recordId)",
  "function getRecordsOfPatient(address patient) view returns (uint256[])",
  "function records(uint256) view returns (uint256 id, address patient, address issuer, uint8 recordType, string ipfsCid, uint8 status, uint256 createdAt, uint256 tokenId)",
  "event RecordCreated(uint256 indexed id, address indexed patient, address indexed issuer, uint8 recordType, string ipfsCid, uint256 tokenId)",
  "event PrescriptionDispensed(uint256 indexed recordId, address indexed pharmacy)",
  "event RecordRevoked(uint256 indexed recordId)",
];

// Mirror MedicalRecordRegistry.sol's enums — index === on-chain uint8 value.
export const RECORD_TYPES = ["Consultation", "LabResult", "Prescription", "Imaging", "Discharge", "Vaccination"];
export const RECORD_STATUS = ["Active", "Dispensed", "Revoked"];

export function recordTypeLabel(recordType) {
  return RECORD_TYPES[recordType] ?? "Unknown";
}

export function recordStatusLabel(status) {
  return RECORD_STATUS[status] ?? "Unknown";
}

/// Loads every record belonging to a patient, keeping id/status/timestamps as
/// plain numbers so components don't need to know about ethers BigNumbers.
export async function loadPatientRecords(medicalRecordRegistry, patientAddress) {
  const ids = await medicalRecordRegistry.getRecordsOfPatient(patientAddress);
  const records = await Promise.all(ids.map((id) => medicalRecordRegistry.records(id)));

  return records.map((r) => ({
    id: r.id.toNumber(),
    patient: r.patient,
    issuer: r.issuer,
    recordType: r.recordType,
    ipfsCid: r.ipfsCid,
    status: r.status,
    createdAt: r.createdAt.toNumber(),
    tokenId: r.tokenId.toNumber(),
  }));
}

// Finds every prescription this pharmacy has ever dispensed via the
// PrescriptionDispensed event log, then re-reads current record state for
// each — backs the pharmacy's batch-claim panel, which needs "everything
// I've dispensed" regardless of which patient it belongs to (unlike
// loadPatientRecords, which is scoped to one already-selected patient).
export async function loadDispensedByPharmacy(medicalRecordRegistry, pharmacyAddress) {
  const fromBlock = await getSafeFromBlock(medicalRecordRegistry.provider);
  const filter = medicalRecordRegistry.filters.PrescriptionDispensed(null, pharmacyAddress);
  const logs = await medicalRecordRegistry.queryFilter(filter, fromBlock);

  const records = await Promise.all(logs.map((log) => medicalRecordRegistry.records(log.args.recordId)));
  return records.map((r) => ({
    id: r.id.toNumber(),
    patient: r.patient,
    issuer: r.issuer,
    recordType: r.recordType,
    ipfsCid: r.ipfsCid,
    status: r.status,
    createdAt: r.createdAt.toNumber(),
    tokenId: r.tokenId.toNumber(),
  }));
}

// There's no on-chain "records by issuer" index (only recordsOfPatient) — so
// Laboratory/Pharmacy "my test history" views find their own ids via the
// RecordCreated event log, then re-read current state for each (status may
// have since changed, e.g. a prescription being dispensed).
export async function loadRecordsByIssuer(medicalRecordRegistry, issuerAddress) {
  const fromBlock = await getSafeFromBlock(medicalRecordRegistry.provider);
  const filter = medicalRecordRegistry.filters.RecordCreated(null, null, issuerAddress);
  const logs = await medicalRecordRegistry.queryFilter(filter, fromBlock);

  const records = await Promise.all(logs.map((log) => medicalRecordRegistry.records(log.args.id)));
  return records.map((r) => ({
    id: r.id.toNumber(),
    patient: r.patient,
    issuer: r.issuer,
    recordType: r.recordType,
    ipfsCid: r.ipfsCid,
    status: r.status,
    createdAt: r.createdAt.toNumber(),
    tokenId: r.tokenId.toNumber(),
  }));
}
