"use client";

import { useState } from "react";
import { UserCheck } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import EmptyState from "@/components/EmptyState";

// Patients the hospital has checked in and dispatched to this doctor today
// (VisitRegistry.assignDoctor). This is a dispatch hint only — it does not
// grant record access by itself; "Request Access" below still goes through
// the normal, unmodified AccessControlRegistry request/approve flow. It's
// surfaced here because the patient is already mid-visit and likely to
// approve immediately.
export default function CheckedInPatients({ visits, patientNames, onAccessRequested }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [requestingFor, setRequestingFor] = useState(null);

  async function requestAccess(patientAddress) {
    setRequestingFor(patientAddress);
    try {
      await runTx(() => contracts.access.requestAccess(patientAddress), {
        pendingLabel: "Requesting access…",
        successLabel: "Access requested — the patient is already checked in and can approve right away",
      });
      onAccessRequested?.();
    } catch {
      // toast already shows the failure
    } finally {
      setRequestingFor(null);
    }
  }

  if (visits.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="No checked-in patients"
        description="Patients a hospital checks in and assigns to you will appear here."
      />
    );
  }

  return (
    <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
      {visits.map((visit) => (
        <div key={visit.id} className="p-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">{patientNames[visit.patient] || "Patient"}</p>
            <p className="text-xs text-gray-500">Checked in {new Date(visit.checkedInAt * 1000).toLocaleTimeString()}</p>
          </div>
          <button
            onClick={() => requestAccess(visit.patient)}
            disabled={requestingFor === visit.patient}
            className="rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-light disabled:opacity-50 shrink-0"
          >
            Request Access
          </button>
        </div>
      ))}
    </div>
  );
}
