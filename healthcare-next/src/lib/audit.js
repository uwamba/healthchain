// Deliberately not backed by a dedicated on-chain "audit log" contract — every
// meaningful action across the 5 contracts already emits an indexed event,
// which is itself immutable and tamper-evident once mined. Re-storing that
// same information in a bespoke contract would just duplicate data we already
// have for free, at extra gas cost, with no added trust guarantee. Instead,
// this module aggregates the existing events via queryFilter() to feed the
// Hospital stats, Analytics charts, Patient "recent activity", and the
// landing page's trust stats. See docs/SECURITY.md for the full reasoning.

import { getSafeFromBlock, queryFilterChunked } from "@/lib/blockRange";

// Every event across every contract, tagged with which contract/label
// produced it and a friendly description template. Kept in one place so
// every dashboard's "recent activity" feed reads identically.
const EVENT_SOURCES = [
  { contractKey: "identity", eventName: "Registered", describe: (a) => `${a.name} registered` },
  { contractKey: "identity", eventName: "HospitalAffiliationConfirmed", describe: () => "Hospital affiliation confirmed" },
  { contractKey: "appointment", eventName: "AppointmentBooked", describe: () => "Appointment booked" },
  { contractKey: "appointment", eventName: "AppointmentCancelled", describe: () => "Appointment cancelled" },
  { contractKey: "records", eventName: "RecordCreated", describe: () => "Medical record created" },
  { contractKey: "records", eventName: "PrescriptionDispensed", describe: () => "Prescription dispensed" },
  { contractKey: "records", eventName: "RecordRevoked", describe: () => "Record revoked" },
  { contractKey: "access", eventName: "AccessRequested", describe: () => "Access requested" },
  { contractKey: "access", eventName: "AccessApproved", describe: () => "Access approved" },
  { contractKey: "access", eventName: "AccessDenied", describe: () => "Access denied" },
  { contractKey: "access", eventName: "AccessRevoked", describe: () => "Access revoked" },
  { contractKey: "claim", eventName: "ClaimSubmitted", describe: () => "Insurance claim submitted" },
  { contractKey: "claim", eventName: "ClaimPatientApproved", describe: () => "Claim visibility approved by patient" },
  { contractKey: "claim", eventName: "ClaimAutoApproved", describe: () => "Pharmacy claim auto-visible to insurer" },
  { contractKey: "claim", eventName: "ClaimPatientDenied", describe: () => "Claim visibility denied by patient" },
  { contractKey: "claim", eventName: "ClaimApproved", describe: () => "Insurance claim approved" },
  { contractKey: "claim", eventName: "ClaimRejected", describe: () => "Insurance claim rejected" },
  { contractKey: "claim", eventName: "VisibilityRenewalRequested", describe: () => "Claim visibility renewal requested" },
  { contractKey: "claim", eventName: "VisibilityRenewed", describe: () => "Claim visibility renewed by patient" },
  { contractKey: "visit", eventName: "VisitRequested", describe: () => "Hospital check-in requested" },
  { contractKey: "visit", eventName: "VisitApproved", describe: () => "Patient checked in" },
  { contractKey: "visit", eventName: "VisitDoctorAssigned", describe: () => "Doctor assigned to visit" },
  { contractKey: "visit", eventName: "VisitCancelled", describe: () => "Visit cancelled" },
  { contractKey: "referral", eventName: "ReferralRequested", describe: () => "Lab referral requested" },
  { contractKey: "referral", eventName: "ReferralApproved", describe: () => "Lab referral approved" },
  { contractKey: "referral", eventName: "ReferralDenied", describe: () => "Lab referral denied" },
  { contractKey: "referral", eventName: "ReferralCompleted", describe: () => "Lab referral completed" },
  { contractKey: "referral", eventName: "ReferralResultApproved", describe: () => "Lab result shared with doctor" },
];

// `contracts` is the same shape WalletContext exposes: { identity, appointment, nft, records, access }.
export async function loadAuditTrail(contracts, { fromBlock } = {}) {
  const events = [];
  const resolvedFromBlock = fromBlock ?? (await getSafeFromBlock(contracts.identity.provider));

  for (const source of EVENT_SOURCES) {
    const contract = contracts[source.contractKey];
    if (!contract) continue;

    const filter = contract.filters[source.eventName]();
    const logs = await queryFilterChunked(contract, filter, resolvedFromBlock);

    for (const log of logs) {
      events.push({
        contractKey: source.contractKey,
        eventName: source.eventName,
        description: source.describe(log.args),
        args: log.args,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      });
    }
  }

  // Attach block timestamps, deduped so we don't re-fetch the same block
  // once per event when several events land in one transaction/block.
  const uniqueBlockNumbers = [...new Set(events.map((e) => e.blockNumber))];
  const provider = contracts.identity.provider;
  const blocks = await Promise.all(uniqueBlockNumbers.map((n) => provider.getBlock(n)));
  const timestampByBlock = new Map(uniqueBlockNumbers.map((n, i) => [n, blocks[i].timestamp]));

  return events
    .map((e) => ({ ...e, timestamp: timestampByBlock.get(e.blockNumber) }))
    .sort((a, b) => b.blockNumber - a.blockNumber);
}

// Summary counts used by the Hospital dashboard's stat row and the landing
// page's trust stats — both just want "how many of X have ever happened".
export function summarizeAuditTrail(events) {
  return {
    totalTransactions: events.length,
    recordsCreated: events.filter((e) => e.eventName === "RecordCreated").length,
    appointmentsBooked: events.filter((e) => e.eventName === "AppointmentBooked").length,
    accessGrantsApproved: events.filter((e) => e.eventName === "AccessApproved").length,
    registrations: events.filter((e) => e.eventName === "Registered").length,
  };
}

// Most events carry a direct `patient`/`account` field, so scoping to one
// patient is a plain equality check. A handful of "resolution" events only
// carry an id (e.g. RecordRevoked only has `recordId`, not the patient it
// belongs to) — for those we fall back to the patient's own known id lists
// (already loaded elsewhere on the dashboard via getRecordsOfPatient /
// getVisitsOfPatient / getReferralsOfPatient / getClaimsForPatient / the
// patient's own appointment list) rather than re-querying the chain again.
const ID_ONLY_EVENTS = {
  AppointmentCancelled: "appointmentIds",
  PrescriptionDispensed: "recordIds",
  RecordRevoked: "recordIds",
  VisitDoctorAssigned: "visitIds",
  VisitApproved: "visitIds",
  VisitCancelled: "visitIds",
  ReferralApproved: "referralIds",
  ReferralDenied: "referralIds",
  ReferralCompleted: "referralIds",
  ReferralResultApproved: "referralIds",
  ClaimPatientApproved: "claimIds",
  ClaimAutoApproved: "claimIds",
  ClaimPatientDenied: "claimIds",
  ClaimApproved: "claimIds",
  ClaimRejected: "claimIds",
  VisibilityRenewalRequested: "claimIds",
  VisibilityRenewed: "claimIds",
};

export function filterEventsForPatient(events, patientAddress, idsByType = {}) {
  const lower = patientAddress.toLowerCase();
  const idSets = Object.fromEntries(
    Object.entries(idsByType).map(([key, ids]) => [key, new Set(ids)])
  );

  return events.filter((e) => {
    const a = e.args;
    if (a.patient && a.patient.toLowerCase() === lower) return true;
    if (a.account && a.account.toLowerCase() === lower) return true;

    const idListKey = ID_ONLY_EVENTS[e.eventName];
    if (idListKey && idSets[idListKey]) {
      const rawId = a.recordId ?? a.id;
      return idSets[idListKey].has(rawId.toNumber());
    }
    return false;
  });
}

// One-shot helper for the Patient dashboard's Activity Log: loads every event
// network-wide (same base data Hospital's log uses) and narrows it down to
// only what actually belongs to this patient.
export async function loadPatientEventLog(contracts, patientAddress, idsByType = {}) {
  const events = await loadAuditTrail(contracts);
  return filterEventsForPatient(events, patientAddress, idsByType);
}

// Day-bucketed counts for the Analytics dashboard's line/bar charts —
// `eventNames` narrows to just the events relevant to that chart.
export function bucketByDay(events, eventNames) {
  const filtered = events.filter((e) => eventNames.includes(e.eventName));
  const counts = new Map();

  for (const event of filtered) {
    const day = new Date(event.timestamp * 1000).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
}
