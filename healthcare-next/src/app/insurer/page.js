"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, History, ShieldCheck } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { loadClaimsForInsurer, checkClaimRecordsValid, claimStatusLabel } from "@/lib/claimRegistry";
import EmptyState from "@/components/EmptyState";
import { SkeletonRow } from "@/components/Skeleton";

const MENU_ITEMS = [
  { key: "pending", label: "Pending Claims", icon: Clock },
  { key: "history", label: "Claim History", icon: History },
];

function InsurerDashboard() {
  const { account, contracts } = useWallet();
  const { runTx } = useContractTx();
  const [activeTab, setActiveTab] = useState("pending");
  const [claims, setClaims] = useState(null);
  const [directoryNames, setDirectoryNames] = useState({});
  const [validityByClaim, setValidityByClaim] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const all = await loadClaimsForInsurer(contracts.claim, account);
    setClaims(all);

    const addresses = [...new Set([...all.map((c) => c.patient), ...all.map((c) => c.provider)])];
    const profiles = await Promise.all(addresses.map((addr) => contracts.identity.profiles(addr)));
    setDirectoryNames(
      Object.fromEntries(addresses.map((addr, i) => [addr, profiles[i].organization || profiles[i].name]))
    );

    const validityEntries = await Promise.all(
      all.map(async (claim) => [claim.id, await checkClaimRecordsValid(contracts.records, claim)])
    );
    setValidityByClaim(Object.fromEntries(validityEntries));
  }, [contracts, account]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(claimId) {
    setBusyId(claimId);
    try {
      await runTx(() => contracts.claim.approveClaim(claimId), {
        pendingLabel: "Approving claim…",
        successLabel: "Claim approved",
      });
      load();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  async function reject(claimId) {
    setBusyId(claimId);
    try {
      await runTx(() => contracts.claim.rejectClaim(claimId), {
        pendingLabel: "Rejecting claim…",
        successLabel: "Claim rejected",
      });
      load();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  async function requestRenewal(claimId) {
    setBusyId(claimId);
    try {
      await runTx(() => contracts.claim.requestVisibilityRenewal(claimId), {
        pendingLabel: "Requesting renewal…",
        successLabel: "Renewal requested — waiting on the patient",
      });
      load();
    } catch {
      // toast already shows the failure
    } finally {
      setBusyId(null);
    }
  }

  const pendingClaims = claims?.filter((c) => c.status === 1) ?? [];
  const historyClaims = claims?.filter((c) => c.status !== 0 && c.status !== 1) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-11 w-11 rounded-full bg-brand-pale text-brand flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Insurance Dashboard</h1>
          <p className="text-gray-500 text-sm">Claims are only visible here once the patient has approved them.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        <aside className="min-w-0">
          <nav className="glass rounded-2xl p-2 flex lg:flex-col gap-1">
            {MENU_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-left whitespace-nowrap transition-colors ${
                  activeTab === key ? "bg-brand text-white" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          {claims === null ? (
            <SkeletonRow />
          ) : activeTab === "pending" ? (
            <ClaimList
              claims={pendingClaims}
              directoryNames={directoryNames}
              validityByClaim={validityByClaim}
              busyId={busyId}
              onApprove={approve}
              onReject={reject}
              onRequestRenewal={requestRenewal}
            />
          ) : (
            <ClaimList
              claims={historyClaims}
              directoryNames={directoryNames}
              validityByClaim={validityByClaim}
              busyId={busyId}
              onRequestRenewal={requestRenewal}
              readOnly
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ClaimList({ claims, directoryNames, validityByClaim, busyId, onApprove, onReject, onRequestRenewal, readOnly = false }) {
  if (claims.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="Claims a patient has approved will appear here, ready to review."
      />
    );
  }

  return (
    <div className="space-y-3">
      {claims.map((claim) => {
        const isValid = validityByClaim[claim.id];
        return (
          <div key={claim.id} className="glass rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{directoryNames[claim.patient] || "Patient"}</p>
                <p className="text-xs text-gray-500">From {directoryNames[claim.provider] || "Provider"}</p>
              </div>
              <span className="text-xs text-gray-400">{claimStatusLabel(claim.status)}</span>
            </div>

            {claim.hasFullVisibility ? (
              <>
                <p className="text-sm text-gray-600">{claim.description || "No description"}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Amount: {claim.amount.toLocaleString()}</span>
                  <span className={isValid ? "text-medical-green" : "text-red-500"}>
                    {isValid ? "Records verified on-chain" : "Record check failed"}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-amber-600">
                Full detail expired 30 days after patient approval — only the amount and dates remain visible. Request
                renewal to view the description and records again.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              {!claim.hasFullVisibility ? (
                <button
                  onClick={() => onRequestRenewal(claim.id)}
                  disabled={busyId === claim.id}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Request Renewal
                </button>
              ) : (
                !readOnly && (
                  <>
                    <button
                      onClick={() => onReject(claim.id)}
                      disabled={busyId === claim.id}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onApprove(claim.id)}
                      disabled={busyId === claim.id}
                      className="flex-1 rounded-lg bg-medical-green text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InsurerPage() {
  return (
    <RoleGuard requiredRole="Insurer">
      <InsurerDashboard />
    </RoleGuard>
  );
}
