"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { Loader2, Search } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { ROLE } from "@/lib/identityRegistry";
import AddressInput from "@/components/AddressInput";

// MVP patient search is by wallet address — fuzzy name search would need an
// off-chain index of every registered patient, which is out of scope here
// (see docs/ARCHITECTURE.md). Resolves role + current AccessControlRegistry
// grant status for whatever address is entered.
export default function PatientLookup({ onPatientResolved }) {
  const { account, contracts } = useWallet();
  const { runTx } = useContractTx();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(null); // { address, name, hasAccess }
  const [error, setError] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [looking, setLooking] = useState(false);

  async function handleLookup(e) {
    e.preventDefault();
    setError(null);
    setStatus(null);

    const trimmed = input.trim();
    if (!ethers.utils.isAddress(trimmed)) {
      setError("Enter a valid wallet address.");
      return;
    }

    setLooking(true);
    try {
      const role = await contracts.identity.roleOf(trimmed);
      if (role !== ROLE.Patient) {
        setError("This address isn't registered as a patient.");
        return;
      }

      const profile = await contracts.identity.profiles(trimmed);
      const hasAccess = await contracts.access.hasAccess(trimmed, account);
      const resolved = { address: trimmed, name: profile.name, hasAccess };
      setStatus(resolved);
      onPatientResolved?.(resolved);
    } catch (err) {
      console.error("Patient lookup failed:", err);
      setError(
        err?.reason ||
          "Lookup failed — check that your wallet is connected to the same network the contracts are deployed on."
      );
    } finally {
      setLooking(false);
    }
  }

  async function requestAccess() {
    setRequesting(true);
    try {
      await runTx(() => contracts.access.requestAccess(status.address), {
        pendingLabel: "Sending access request…",
        successLabel: "Access request sent — waiting on the patient",
      });
    } catch {
      // toast already shows the failure
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <form onSubmit={handleLookup} className="flex gap-2">
        <AddressInput value={input} onChange={setInput} placeholder="Patient wallet address (0x…)" />
        <button
          type="submit"
          disabled={looking}
          className="rounded-lg bg-brand text-white px-3 py-2 hover:bg-brand-light transition-colors disabled:opacity-50"
        >
          {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      {looking && <p className="text-xs text-gray-400">Looking up address on-chain…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {status && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">{status.name || "Unnamed Patient"}</p>
            <p className="text-xs text-gray-500">
              {status.hasAccess ? "You have active access to their records" : "No access yet"}
            </p>
          </div>
          {!status.hasAccess && (
            <button
              onClick={requestAccess}
              disabled={requesting}
              className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
            >
              Request Access
            </button>
          )}
        </div>
      )}
    </div>
  );
}
