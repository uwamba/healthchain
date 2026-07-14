"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { Loader2, ShieldCheck } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { ROLE } from "@/lib/identityRegistry";
import AddressInput from "@/components/AddressInput";

// Files an insurance claim for a record the calling provider (Hospital/
// Laboratory/Pharmacy) already issued — the claim stays invisible to the
// insurer until the patient approves it from their own dashboard (see
// ClaimRegistry.sol). Submission here is the provider's paperwork, not the
// patient's consent.
export default function FileClaimForm({ patientAddress, recordId, onFiled }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [insurerAddress, setInsurerAddress] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filed, setFiled] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const trimmed = insurerAddress.trim();
    if (!ethers.utils.isAddress(trimmed)) {
      setError("Enter a valid insurer wallet address.");
      return;
    }

    setSubmitting(true);
    try {
      const role = await contracts.identity.roleOf(trimmed);
      if (role !== ROLE.Insurer) {
        setError("That address isn't registered as an insurance company.");
        setSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("Insurer lookup failed:", err);
      setError(
        err?.reason ||
          "Lookup failed — check that your wallet is connected to the same network the contracts are deployed on."
      );
      setSubmitting(false);
      return;
    }

    try {
      await runTx(
        () => contracts.claim.submitClaim(patientAddress, trimmed, [recordId], description, Number(amount) || 0),
        { pendingLabel: "Filing claim…", successLabel: "Claim filed — waiting on patient approval" }
      );
      setFiled(true);
      onFiled?.();
    } catch {
      // toast already shows the failure
    } finally {
      setSubmitting(false);
    }
  }

  if (filed) {
    return <p className="text-xs text-medical-green">Claim filed — the patient must approve it before the insurer can see it.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-gray-100">
      <p className="text-xs font-medium flex items-center gap-1.5 text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5" />
        File Insurance Claim
      </p>
      <AddressInput
        value={insurerAddress}
        onChange={setInsurerAddress}
        placeholder="Insurer wallet address (0x…)"
        className="py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          placeholder="Amount"
          className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        File Claim
      </button>
    </form>
  );
}
