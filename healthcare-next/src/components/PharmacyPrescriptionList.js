"use client";

import { useState } from "react";
import { Pill } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { recordStatusLabel } from "@/lib/medicalRecordRegistry";
import EmptyState from "@/components/EmptyState";

// Once a pharmacy has an approved AccessControlRegistry grant for a patient,
// this lists just that patient's Prescription-type records (recordType 2) —
// a frontend policy filter, same "gate what we show, not what's technically
// readable" model used everywhere else in this app, not a new trust
// mechanism. Active ones get a Dispense button; everything else is history.
export default function PharmacyPrescriptionList({ prescriptions, onDispensed }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [busyId, setBusyId] = useState(null);

  async function dispense(recordId) {
    setBusyId(recordId);
    try {
      await runTx(() => contracts.records.dispensePrescription(recordId), {
        pendingLabel: "Confirming dispense on-chain…",
        successLabel: "Prescription dispensed",
      });
      onDispensed?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  if (prescriptions.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title="No prescriptions"
        description="This patient has no prescription records yet."
      />
    );
  }

  return (
    <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
      {prescriptions.map((record) => (
        <div key={record.id} className="p-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">Prescription #{record.id}</p>
            <p className="text-xs text-gray-500">
              Issued {new Date(record.createdAt * 1000).toLocaleDateString()} — {recordStatusLabel(record.status)}
            </p>
          </div>
          {record.status === 0 ? (
            <button
              onClick={() => dispense(record.id)}
              disabled={busyId === record.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-light disabled:opacity-50 shrink-0"
            >
              <Pill className="h-3.5 w-3.5" />
              Dispense
            </button>
          ) : (
            <span className="text-xs text-gray-400 shrink-0">{recordStatusLabel(record.status)}</span>
          )}
        </div>
      ))}
    </div>
  );
}
