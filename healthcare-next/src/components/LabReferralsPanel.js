"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { referralStatusLabel } from "@/lib/referralRegistry";
import EmptyState from "@/components/EmptyState";

// Two separate consent gates live here, matching ReferralRegistry.sol:
// Requested -> approve/deny sends the referral to the lab; Completed ->
// approve sends the lab's finished result back to the referring doctor.
// Approving the result is a consent/audit record — the doctor's actual
// ability to see the record still comes from AccessControlRegistry,
// unchanged (see docs/ARCHITECTURE.md).
export default function LabReferralsPanel({ referrals, doctorNames, labNames, onResolved }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [busyId, setBusyId] = useState(null);

  async function approveReferral(id) {
    setBusyId(id);
    try {
      await runTx(() => contracts.referral.approveReferral(id), {
        pendingLabel: "Approving referral…",
        successLabel: "Referral approved — the lab can now proceed",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  async function denyReferral(id) {
    setBusyId(id);
    try {
      await runTx(() => contracts.referral.denyReferral(id), {
        pendingLabel: "Denying referral…",
        successLabel: "Referral denied",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  async function approveResult(id) {
    setBusyId(id);
    try {
      await runTx(() => contracts.referral.approveReferralResult(id), {
        pendingLabel: "Sharing result with your doctor…",
        successLabel: "Result shared with your doctor",
      });
      onResolved?.();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  if (referrals.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No lab referrals"
        description="When a doctor refers you to a lab, it will show up here for you to approve."
      />
    );
  }

  return (
    <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
      {referrals.map((referral) => (
        <div key={referral.id} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">{labNames[referral.provider] || "Laboratory"}</p>
              <p className="text-xs text-gray-500">
                Referred by {doctorNames[referral.referringDoctor] || "Doctor"} — {referral.reason || "No reason given"}
              </p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{referralStatusLabel(referral.status)}</span>
          </div>

          {referral.status === 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => denyReferral(referral.id)}
                disabled={busyId === referral.id}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Deny
              </button>
              <button
                onClick={() => approveReferral(referral.id)}
                disabled={busyId === referral.id}
                className="flex-1 rounded-lg bg-medical-green text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                Send to Lab
              </button>
            </div>
          )}

          {referral.status === 3 && (
            <button
              onClick={() => approveResult(referral.id)}
              disabled={busyId === referral.id}
              className="w-full rounded-lg bg-medical-green text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              Share Result With Doctor
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
