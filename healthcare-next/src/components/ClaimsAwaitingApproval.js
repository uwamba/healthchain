"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import EmptyState from "@/components/EmptyState";

// A provider (Hospital/Laboratory/Pharmacy) filed an insurance claim for a
// service they rendered — it stays invisible to the insurer until approved
// here. This is the patient's real consent action, typically done in person
// right after the service (see ClaimRegistry.sol / docs on provider-submitted
// claims).
export default function ClaimsAwaitingApproval({ claims, providerNames, insurerNames, onResolved }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [busyId, setBusyId] = useState(null);

  async function approve(claimId) {
    setBusyId(claimId);
    try {
      await runTx(() => contracts.claim.approvePatientVisibility(claimId), {
        pendingLabel: "Approving claim…",
        successLabel: "Claim sent to insurer",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  async function deny(claimId) {
    setBusyId(claimId);
    try {
      await runTx(() => contracts.claim.denyPatientVisibility(claimId), {
        pendingLabel: "Denying claim…",
        successLabel: "Claim denied — the insurer will never see it",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  if (claims.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No claims awaiting approval"
        description="When a hospital, lab, or pharmacy files an insurance claim for you, it stays hidden from the insurer until you approve it here."
      />
    );
  }

  return (
    <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
      {claims.map((claim) => (
        <div key={claim.id} className="p-3 space-y-2">
          <div>
            <p className="font-medium text-sm">{providerNames[claim.provider] || "Provider"}</p>
            <p className="text-xs text-gray-500">
              To {insurerNames[claim.insurer] || "Insurer"} — {claim.description || "No description"}
            </p>
            <p className="text-xs text-gray-400">Amount: {claim.amount.toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => deny(claim.id)}
              disabled={busyId === claim.id}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={() => approve(claim.id)}
              disabled={busyId === claim.id}
              className="flex-1 rounded-lg bg-medical-green text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
