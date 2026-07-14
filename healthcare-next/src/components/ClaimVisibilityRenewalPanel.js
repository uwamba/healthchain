"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import EmptyState from "@/components/EmptyState";

// A claim's provider/insurer asked to see full detail (description, records)
// again after the 30-day visibility window lapsed — only the patient can
// grant that, same "every access-relevant action needs the patient's own
// signature" rule as everywhere else in this app. See ClaimRegistry.sol's
// requestVisibilityRenewal/approveVisibilityRenewal.
export default function ClaimVisibilityRenewalPanel({ claims, directoryNames, onResolved }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [busyId, setBusyId] = useState(null);

  async function renew(claimId) {
    setBusyId(claimId);
    try {
      await runTx(() => contracts.claim.approveVisibilityRenewal(claimId), {
        pendingLabel: "Renewing visibility…",
        successLabel: "Visibility renewed for another 30 days",
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
        icon={RefreshCcw}
        title="No renewal requests"
        description="If a claim's detail has expired and the insurer asks to see it again, it'll show up here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {claims.map((claim) => (
        <div key={claim.id} className="glass rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">Claim #{claim.id}</p>
            <p className="text-xs text-gray-500">
              {directoryNames[claim.insurer] || "Insurer"} wants to view this claim's detail again
            </p>
          </div>
          <button
            onClick={() => renew(claim.id)}
            disabled={busyId === claim.id}
            className="rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-light disabled:opacity-50 shrink-0"
          >
            Renew
          </button>
        </div>
      ))}
    </div>
  );
}
