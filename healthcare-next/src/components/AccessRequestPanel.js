"use client";

import { useState } from "react";
import { ShieldQuestion } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { DURATION_OPTIONS, DURATION } from "@/lib/accessControlRegistry";
import { roleLabel } from "@/lib/identityRegistry";
import EmptyState from "@/components/EmptyState";

// Patient-side half of the fine-grained RBAC flow: a doctor's or pharmacy's
// pending request shows up here, and only the patient can approve (with a
// fixed duration), deny, or later revoke it — see AccessControlRegistry.sol.
export default function AccessRequestPanel({ pendingRequests, onResolved }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [selectedDuration, setSelectedDuration] = useState({});
  const [busyProvider, setBusyProvider] = useState(null);

  async function approve(provider) {
    const duration = selectedDuration[provider] ?? DURATION.OneWeek;
    setBusyProvider(provider);
    try {
      await runTx(() => contracts.access.approveAccess(provider, duration), {
        pendingLabel: "Approving access…",
        successLabel: "Access approved",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyProvider(null);
    }
  }

  async function deny(provider) {
    setBusyProvider(provider);
    try {
      await runTx(() => contracts.access.denyAccess(provider), {
        pendingLabel: "Denying access…",
        successLabel: "Access denied",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyProvider(null);
    }
  }

  if (pendingRequests.length === 0) {
    return (
      <EmptyState
        icon={ShieldQuestion}
        title="No pending access requests"
        description="When a doctor or pharmacy requests access to your records, it will show up here for you to approve or deny."
      />
    );
  }

  return (
    <div className="space-y-3">
      {pendingRequests.map((request) => (
        <div key={request.provider} className="glass rounded-xl p-4 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{request.providerName || "Unknown Provider"}</p>
              <span className="text-xs font-medium text-brand bg-brand-pale rounded-full px-2 py-0.5">
                {roleLabel(request.role)}
              </span>
            </div>
            <p className="font-mono text-xs text-gray-500">
              {request.provider.slice(0, 6)}…{request.provider.slice(-4)}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1.5">Access Duration</p>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedDuration((prev) => ({ ...prev, [request.provider]: opt.value }))}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    (selectedDuration[request.provider] ?? DURATION.OneWeek) === opt.value
                      ? "border-brand bg-brand-pale text-brand"
                      : "border-gray-200 hover:border-brand/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => deny(request.provider)}
              disabled={busyProvider === request.provider}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={() => approve(request.provider)}
              disabled={busyProvider === request.provider}
              className="flex-1 rounded-lg bg-medical-green text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
