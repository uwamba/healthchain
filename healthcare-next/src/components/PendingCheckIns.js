"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import EmptyState from "@/components/EmptyState";

// A hospital opened a check-in for this patient (VisitRegistry.requestVisit)
// — this is what a scanned front-desk QR deep-links to, but it also just
// shows up here on its own if the patient already has the app open.
export default function PendingCheckIns({ visits, hospitalNames, onResolved }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [busyId, setBusyId] = useState(null);

  async function approve(visitId) {
    setBusyId(visitId);
    try {
      await runTx(() => contracts.visit.approveVisit(visitId), {
        pendingLabel: "Confirming check-in…",
        successLabel: "Checked in",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(visitId) {
    setBusyId(visitId);
    try {
      await runTx(() => contracts.visit.cancelVisit(visitId), {
        pendingLabel: "Cancelling…",
        successLabel: "Check-in cancelled",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  if (visits.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No pending check-ins"
        description="When a hospital checks you in for a visit, it will show up here for you to confirm."
      />
    );
  }

  return (
    <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
      {visits.map((visit) => (
        <div key={visit.id} className="p-3 flex items-center justify-between gap-3">
          <p className="font-medium text-sm">{hospitalNames[visit.hospital] || "Hospital"}</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => cancel(visit.id)}
              disabled={busyId === visit.id}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => approve(visit.id)}
              disabled={busyId === visit.id}
              className="rounded-lg bg-medical-green text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              Confirm Check-In
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
