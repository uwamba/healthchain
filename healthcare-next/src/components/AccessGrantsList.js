"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { roleLabel } from "@/lib/identityRegistry";
import EmptyState from "@/components/EmptyState";

// Lists doctors/pharmacies with currently unexpired approved access, each
// with an early-revoke button — the "Your Health Data. Your Ownership."
// promise made concrete: access can always be pulled back before it
// naturally expires.
export default function AccessGrantsList({ grants, onResolved }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [busyProvider, setBusyProvider] = useState(null);

  async function revoke(provider) {
    setBusyProvider(provider);
    try {
      await runTx(() => contracts.access.revokeAccess(provider), {
        pendingLabel: "Revoking access…",
        successLabel: "Access revoked",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyProvider(null);
    }
  }

  if (grants.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No one currently has access"
        description="Once you approve a doctor's or pharmacy's request, they'll show up here until their access expires or you revoke it."
      />
    );
  }

  return (
    <div className="space-y-2">
      {grants.map((grant) => (
        <div key={grant.provider} className="glass rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{grant.providerName || "Unknown Provider"}</p>
              <span className="text-xs font-medium text-brand bg-brand-pale rounded-full px-2 py-0.5">
                {roleLabel(grant.role)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Expires {new Date(grant.expiresAt * 1000).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => revoke(grant.provider)}
            disabled={busyProvider === grant.provider}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Revoke
          </button>
        </div>
      ))}
    </div>
  );
}
