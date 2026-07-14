"use client";

import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { Building2, Loader2, Search } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { ROLE } from "@/lib/identityRegistry";
import AddressInput from "@/components/AddressInput";

// Closes the gap found when reviewing the full workflow: IdentityRegistry
// already supports requestHospitalAffiliation/confirmHospitalAffiliation and
// the Hospital dashboard already confirms, but no page ever called
// requestHospitalAffiliation. This is that missing half, following the same
// address-lookup-then-act shape as PatientLookup.
export default function RequestAffiliationForm() {
  const { account, contracts } = useWallet();
  const { runTx } = useContractTx();
  const [currentHospital, setCurrentHospital] = useState(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [looking, setLooking] = useState(false);
  const [loadingAffiliation, setLoadingAffiliation] = useState(true);

  const loadAffiliation = useCallback(async () => {
    setLoadingAffiliation(true);
    try {
      const profile = await contracts.identity.profiles(account);
      if (profile.hospital !== ethers.constants.AddressZero) {
        const hospitalProfile = await contracts.identity.profiles(profile.hospital);
        setCurrentHospital({ address: profile.hospital, name: hospitalProfile.organization || hospitalProfile.name });
      } else {
        setCurrentHospital(null);
      }
    } catch (err) {
      console.error("Failed to load hospital affiliation:", err);
    } finally {
      setLoadingAffiliation(false);
    }
  }, [account, contracts]);

  useEffect(() => {
    loadAffiliation();
  }, [loadAffiliation]);

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
      if (role !== ROLE.Hospital) {
        setError("This address isn't registered as a hospital.");
        return;
      }
      const profile = await contracts.identity.profiles(trimmed);
      setStatus({ address: trimmed, name: profile.organization || profile.name });
    } catch (err) {
      console.error("Hospital lookup failed:", err);
      setError(
        err?.reason ||
          "Lookup failed — check that your wallet is connected to the same network the contracts are deployed on."
      );
    } finally {
      setLooking(false);
    }
  }

  async function requestAffiliation() {
    setRequesting(true);
    try {
      await runTx(() => contracts.identity.requestHospitalAffiliation(status.address), {
        pendingLabel: "Sending affiliation request…",
        successLabel: "Affiliation request sent — waiting on the hospital",
      });
    } catch {
      // toast already shows the failure
    } finally {
      setRequesting(false);
    }
  }

  if (loadingAffiliation) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your affiliation…
      </div>
    );
  }

  if (currentHospital) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-brand-pale text-brand flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Currently affiliated with</p>
          <p className="font-medium text-sm">{currentHospital.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <form onSubmit={handleLookup} className="flex gap-2">
        <AddressInput value={input} onChange={setInput} placeholder="Hospital wallet address (0x…)" />
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
          <p className="font-medium text-sm">{status.name || "Unnamed Hospital"}</p>
          <button
            onClick={requestAffiliation}
            disabled={requesting}
            className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
          >
            Request Affiliation
          </button>
        </div>
      )}
    </div>
  );
}
