"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Pill, QrCode, ScanLine, XCircle } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { recordStatusLabel, loadPatientRecords, loadDispensedByPharmacy } from "@/lib/medicalRecordRegistry";
import { loadApprovedPatientsForDoctor } from "@/lib/accessControlRegistry";
import QRScanner from "@/components/QRScanner";
import FileClaimForm from "@/components/FileClaimForm";
import PatientLookup from "@/components/PatientLookup";
import MyPatients from "@/components/MyPatients";
import PharmacyPrescriptionList from "@/components/PharmacyPrescriptionList";
import BatchClaimPanel from "@/components/BatchClaimPanel";
import EmptyState from "@/components/EmptyState";
import { SkeletonRow } from "@/components/Skeleton";

const PRESCRIPTION_TYPE = 2;

// Scan -> Verify -> Status -> Dispense -> Confirmed, presented as a focused
// stepper rather than embedded in regular dashboard chrome — mirrors a real
// point-of-sale flow and makes the QR verification the visual centerpiece.
const STEPS = ["Scan", "Verify", "Dispense"];

function PharmacyDashboard() {
  const { account, contracts } = useWallet();
  const { runTx } = useContractTx();
  const [stepIndex, setStepIndex] = useState(0);
  const [manualId, setManualId] = useState("");
  const [record, setRecord] = useState(null);
  const [prescriberName, setPrescriberName] = useState("");
  const [lookupError, setLookupError] = useState(null);
  const [dispensed, setDispensed] = useState(false);
  const [dispensing, setDispensing] = useState(false);

  const [myPatients, setMyPatients] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [prescriptions, setPrescriptions] = useState(null);
  const [unclaimedDispensed, setUnclaimedDispensed] = useState(null);
  const [dispensedPatientNames, setDispensedPatientNames] = useState({});

  const loadMyPatients = useCallback(async () => {
    const patients = await loadApprovedPatientsForDoctor(contracts.access, contracts.identity, account);
    setMyPatients(patients);
  }, [account, contracts]);

  const loadPrescriptions = useCallback(async () => {
    if (!selectedPatient?.hasAccess) {
      setPrescriptions(null);
      return;
    }
    const records = await loadPatientRecords(contracts.records, selectedPatient.address);
    setPrescriptions(records.filter((r) => r.recordType === PRESCRIPTION_TYPE));
  }, [contracts, selectedPatient]);

  const loadUnclaimedDispensed = useCallback(async () => {
    const dispensed = await loadDispensedByPharmacy(contracts.records, account);
    const claimedFlags = await Promise.all(dispensed.map((r) => contracts.claim.recordClaimed(r.id)));
    const unclaimed = dispensed.filter((_, i) => !claimedFlags[i]);
    setUnclaimedDispensed(unclaimed);

    const uniquePatients = [...new Set(unclaimed.map((r) => r.patient))];
    const profiles = await Promise.all(uniquePatients.map((addr) => contracts.identity.profiles(addr)));
    setDispensedPatientNames(Object.fromEntries(uniquePatients.map((addr, i) => [addr, profiles[i].name])));
  }, [account, contracts]);

  useEffect(() => {
    loadMyPatients();
  }, [loadMyPatients]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  useEffect(() => {
    loadUnclaimedDispensed();
  }, [loadUnclaimedDispensed]);

  async function verifyRecordId(recordId) {
    setLookupError(null);
    try {
      const r = await contracts.records.records(recordId);
      if (r.recordType !== 2) {
        setLookupError("This record is not a prescription.");
        return;
      }
      const profile = await contracts.identity.profiles(r.issuer);
      setPrescriberName(profile.name);
      setRecord({
        id: r.id.toNumber(),
        patient: r.patient,
        issuer: r.issuer,
        status: r.status,
        createdAt: r.createdAt.toNumber(),
      });
      setStepIndex(1);
    } catch {
      setLookupError("No record found with that id — check the QR / id and try again.");
    }
  }

  function handleScan(decodedText) {
    try {
      const { recordId } = JSON.parse(decodedText);
      verifyRecordId(recordId);
    } catch {
      setLookupError("Unrecognized QR content.");
    }
  }

  async function handleDispense() {
    setDispensing(true);
    try {
      await runTx(() => contracts.records.dispensePrescription(record.id), {
        pendingLabel: "Confirming dispense on-chain…",
        successLabel: "Prescription dispensed",
      });
      setDispensed(true);
      setStepIndex(2);
      loadUnclaimedDispensed();
      if (selectedPatient?.address?.toLowerCase() === record.patient.toLowerCase()) loadPrescriptions();
    } catch {
      // toast already shows the failure
    } finally {
      setDispensing(false);
    }
  }

  function reset() {
    setStepIndex(0);
    setRecord(null);
    setManualId("");
    setLookupError(null);
    setDispensed(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Pharmacy Dashboard</h1>
        <p className="text-gray-500 text-sm">Look up a patient and request permission to view their prescriptions.</p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-8">
        <aside className="space-y-6 min-w-0">
          <div>
            <h2 className="text-lg font-semibold mb-3">My Patients</h2>
            {myPatients === null ? <SkeletonRow /> : <MyPatients patients={myPatients} onSelect={setSelectedPatient} />}
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3">Patient Lookup</h2>
            <p className="text-xs text-gray-400 mb-2">Look up a new patient by address to request prescription access.</p>
            <PatientLookup onPatientResolved={setSelectedPatient} />
          </div>
        </aside>

        <section className="min-w-0">
          <h2 className="text-lg font-semibold mb-4">Prescriptions</h2>
          {!selectedPatient ? (
            <EmptyState
              title="Look up a patient"
              description="Look up a patient by wallet address to view their prescriptions or request access."
            />
          ) : !selectedPatient.hasAccess ? (
            <EmptyState
              title="Access not yet granted"
              description="Send a request from the patient lookup panel — the patient must approve it before you can view their prescriptions."
            />
          ) : prescriptions === null ? (
            <SkeletonRow />
          ) : (
            <PharmacyPrescriptionList prescriptions={prescriptions} onDispensed={loadPrescriptions} />
          )}
        </section>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Batch Insurance Claims</h2>
        <p className="text-xs text-gray-400 mb-4">
          Dispensed prescriptions you haven't billed yet, grouped by patient — select some and file one claim per
          patient whenever you choose to reconcile (e.g. monthly).
        </p>
        {unclaimedDispensed === null ? (
          <SkeletonRow />
        ) : (
          <BatchClaimPanel
            records={unclaimedDispensed}
            patientNames={dispensedPatientNames}
            onSubmitted={loadUnclaimedDispensed}
          />
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Quick Dispense</h2>
        <p className="text-xs text-gray-400 mb-4">Already have a specific prescription's QR or record ID? Skip the lookup above.</p>

        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${
                    i <= stepIndex ? "bg-brand text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-sm ${i <= stepIndex ? "font-medium" : "text-gray-400"}`}>{label}</span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
              </div>
            ))}
          </div>

          {stepIndex === 0 && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-brand" />
                <h2 className="font-semibold">Scan Prescription QR</h2>
              </div>
              <QRScanner onScan={handleScan} />
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="flex-1 h-px bg-gray-200" /> or enter manually <span className="flex-1 h-px bg-gray-200" />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualId !== "") verifyRecordId(manualId);
                }}
                className="flex gap-2"
              >
                <input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Record ID"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <button type="submit" className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-light">
                  Verify
                </button>
              </form>
              {lookupError && (
                <p className="text-sm text-red-500 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> {lookupError}
                </p>
              )}
            </div>
          )}

          {stepIndex === 1 && record && (
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-medical-green">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="font-semibold">Valid Prescription</h2>
              </div>

              <dl className="text-sm space-y-2">
                <Row label="Doctor" value={prescriberName || "Unknown"} />
                <Row label="Issued" value={new Date(record.createdAt * 1000).toLocaleDateString()} />
                <Row label="Status" value={recordStatusLabel(record.status)} />
              </dl>

              {record.status !== 0 ? (
                <p className="text-sm text-gray-500">This prescription has already been {recordStatusLabel(record.status).toLowerCase()}.</p>
              ) : (
                <button
                  onClick={handleDispense}
                  disabled={dispensing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-white px-4 py-2.5 font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
                >
                  <Pill className="h-4 w-4" />
                  Dispense Medication
                </button>
              )}
              <button onClick={reset} className="w-full text-sm text-gray-500 hover:text-foreground">
                Cancel
              </button>
            </div>
          )}

          {stepIndex === 2 && dispensed && (
            <div className="glass rounded-2xl p-6 text-center space-y-4">
              <CheckCircle2 className="h-10 w-10 text-medical-green mx-auto" />
              <h2 className="font-semibold">Dispensed & Recorded On-Chain</h2>
              <p className="text-sm text-gray-500">The audit record for this dispense is now permanent.</p>

              <div className="text-left">
                <FileClaimForm patientAddress={record.patient} recordId={record.id} onFiled={loadUnclaimedDispensed} />
              </div>

              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                <QrCode className="h-4 w-4" />
                Scan Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export default function PharmacyPage() {
  return (
    <RoleGuard requiredRole="Pharmacy">
      <PharmacyDashboard />
    </RoleGuard>
  );
}
