"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { FlaskConical, Loader2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { ROLE } from "@/lib/identityRegistry";
import AddressInput from "@/components/AddressInput";

// Doctor refers the currently-selected patient to a lab. Both directions of
// this referral are gated by the patient's own approval (see
// ReferralRegistry.sol) — this form only creates the request; the patient
// approves it from their own dashboard before the lab can act on it.
export default function ReferToLabForm({ patientAddress, onReferred }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [labAddress, setLabAddress] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const trimmed = labAddress.trim();
    if (!ethers.utils.isAddress(trimmed)) {
      setError("Enter a valid laboratory wallet address.");
      return;
    }

    setSubmitting(true);
    try {
      const role = await contracts.identity.roleOf(trimmed);
      if (role !== ROLE.Laboratory) {
        setError("That address isn't registered as a laboratory.");
        setSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("Laboratory lookup failed:", err);
      setError(
        err?.reason ||
          "Lookup failed — check that your wallet is connected to the same network the contracts are deployed on."
      );
      setSubmitting(false);
      return;
    }

    try {
      await runTx(() => contracts.referral.createReferral(patientAddress, trimmed, reason), {
        pendingLabel: "Sending referral…",
        successLabel: "Referral sent — waiting on the patient to approve",
      });
      setLabAddress("");
      setReason("");
      onReferred?.();
    } catch {
      // toast already shows the failure
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 space-y-3">
      <p className="font-medium flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-blockchain-purple" />
        Refer to Laboratory
      </p>
      <AddressInput value={labAddress} onChange={setLabAddress} placeholder="Laboratory wallet address (0x…)" />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for referral (e.g. Blood panel)"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {submitting && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Verifying laboratory on-chain…
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-white px-4 py-2.5 font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Send Referral
      </button>
    </form>
  );
}
