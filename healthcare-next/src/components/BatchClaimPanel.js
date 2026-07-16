"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { FileStack, Loader2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { ROLE } from "@/lib/identityRegistry";
import { recordTypeLabel } from "@/lib/medicalRecordRegistry";
import AddressInput from "@/components/AddressInput";
import EmptyState from "@/components/EmptyState";

// Records this provider (Pharmacy or Hospital) hasn't billed yet, grouped by
// patient — since ClaimRegistry.submitClaim already accepts an array of
// recordIds, one claim can bundle a whole month's worth of a patient's
// unbilled records instead of filing per-record. There's no on-chain
// scheduler to enforce "monthly" — this page is simply opened whenever the
// provider chooses to reconcile.
export default function BatchClaimPanel({ records, patientNames, onSubmitted, emptyDescription }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [selected, setSelected] = useState({});
  const [insurerByPatient, setInsurerByPatient] = useState({});
  const [descByPatient, setDescByPatient] = useState({});
  const [amountByPatient, setAmountByPatient] = useState({});
  const [submittingPatient, setSubmittingPatient] = useState(null);
  const [error, setError] = useState(null);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      if (!map.has(r.patient)) map.set(r.patient, []);
      map.get(r.patient).push(r);
    }
    return [...map.entries()];
  }, [records]);

  function toggle(recordId) {
    setSelected((prev) => ({ ...prev, [recordId]: !prev[recordId] }));
  }

  async function submit(patientAddress, recordIds) {
    setError(null);
    const insurer = (insurerByPatient[patientAddress] || "").trim();
    if (!ethers.utils.isAddress(insurer)) {
      setError("Enter a valid insurer wallet address.");
      return;
    }

    setSubmittingPatient(patientAddress);
    try {
      const role = await contracts.identity.roleOf(insurer);
      if (role !== ROLE.Insurer) {
        setError("That address isn't registered as an insurance company.");
        setSubmittingPatient(null);
        return;
      }
    } catch (err) {
      console.error("Insurer lookup failed:", err);
      setError("Lookup failed — check that your wallet is connected to the same network the contracts are deployed on.");
      setSubmittingPatient(null);
      return;
    }

    try {
      await runTx(
        () =>
          contracts.claim.submitClaim(
            patientAddress,
            insurer,
            recordIds,
            descByPatient[patientAddress] || "",
            Number(amountByPatient[patientAddress]) || 0
          ),
        { pendingLabel: "Filing batch claim…", successLabel: "Claim filed" }
      );
      setSelected((prev) => {
        const next = { ...prev };
        recordIds.forEach((id) => delete next[id]);
        return next;
      });
      onSubmitted?.();
    } catch {
      // toast already shows the failure
    } finally {
      setSubmittingPatient(null);
    }
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={FileStack}
        title="Nothing to claim"
        description={
          emptyDescription ||
          "Records that haven't been billed yet will appear here, grouped by patient, so you can batch several into one claim whenever you choose to reconcile (e.g. monthly)."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([patientAddress, patientRecords]) => {
        const selectedIds = patientRecords.filter((r) => selected[r.id]).map((r) => r.id);
        return (
          <div key={patientAddress} className="glass rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-medium text-sm">{patientNames[patientAddress] || "Unnamed Patient"}</p>
              <p className="text-xs text-gray-500 font-mono">
                {patientAddress.slice(0, 6)}…{patientAddress.slice(-4)}
              </p>
            </div>

            <div className="space-y-1.5">
              {patientRecords.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected[r.id]}
                    onChange={() => toggle(r.id)}
                    className="rounded border-gray-300"
                  />
                  {recordTypeLabel(r.recordType)} #{r.id} — issued {new Date(r.createdAt * 1000).toLocaleDateString()}
                </label>
              ))}
            </div>

            {selectedIds.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <AddressInput
                  value={insurerByPatient[patientAddress] || ""}
                  onChange={(v) => setInsurerByPatient((prev) => ({ ...prev, [patientAddress]: v }))}
                  placeholder="Insurer wallet address (0x…)"
                  className="text-xs py-1.5"
                />
                <div className="flex gap-2">
                  <input
                    value={descByPatient[patientAddress] || ""}
                    onChange={(e) => setDescByPatient((prev) => ({ ...prev, [patientAddress]: e.target.value }))}
                    placeholder="Description"
                    className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <input
                    value={amountByPatient[patientAddress] || ""}
                    onChange={(e) => setAmountByPatient((prev) => ({ ...prev, [patientAddress]: e.target.value }))}
                    type="number"
                    placeholder="Total amount"
                    className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  onClick={() => submit(patientAddress, selectedIds)}
                  disabled={submittingPatient === patientAddress}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
                >
                  {submittingPatient === patientAddress && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  File Claim for {selectedIds.length} Record{selectedIds.length > 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
