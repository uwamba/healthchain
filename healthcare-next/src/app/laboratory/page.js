"use client";

import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { FlaskConical, Loader2, Search } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useWallet } from "@/context/WalletContext";
import { ROLE } from "@/lib/identityRegistry";
import { loadRecordsByIssuer } from "@/lib/medicalRecordRegistry";
import { loadReferralsForProvider } from "@/lib/referralRegistry";
import CreateRecordForm from "@/components/CreateRecordForm";
import MedicalAssetCard from "@/components/MedicalAssetCard";
import AssignedReferrals from "@/components/AssignedReferrals";
import FileClaimForm from "@/components/FileClaimForm";
import AddressInput from "@/components/AddressInput";
import EmptyState from "@/components/EmptyState";
import { SkeletonGrid, SkeletonRow } from "@/components/Skeleton";

const LAB_RECORD_TYPES = [1, 3]; // LabResult, Imaging

function LaboratoryDashboard() {
  const { account, contracts } = useWallet();
  const [input, setInput] = useState("");
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const [looking, setLooking] = useState(false);
  const [history, setHistory] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [referralPatientNames, setReferralPatientNames] = useState({});

  const loadHistory = useCallback(async () => {
    const records = await loadRecordsByIssuer(contracts.records, account);
    setHistory(records);
  }, [contracts, account]);

  const loadReferrals = useCallback(async () => {
    const all = await loadReferralsForProvider(contracts.referral, account);
    const approved = all.filter((r) => r.status === 1); // Approved, ready to complete
    setReferrals(approved);

    const uniquePatients = [...new Set(approved.map((r) => r.patient))];
    const profiles = await Promise.all(uniquePatients.map((addr) => contracts.identity.profiles(addr)));
    setReferralPatientNames(Object.fromEntries(uniquePatients.map((addr, i) => [addr, profiles[i].name])));
  }, [contracts, account]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  async function handleLookup(e) {
    e.preventDefault();
    setError(null);
    setPatient(null);

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
      setPatient({ address: trimmed, name: profile.name });
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

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid lg:grid-cols-[360px_1fr] gap-8">
      <aside className="space-y-4 min-w-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-blockchain-purple" />
          Select Patient
        </h2>
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
          {patient && <p className="text-sm font-medium">{patient.name || "Unnamed Patient"}</p>}
        </div>

        <h2 className="text-lg font-semibold">Upload Laboratory Result</h2>
        <CreateRecordForm patientAddress={patient?.address} allowedTypes={LAB_RECORD_TYPES} onCreated={loadHistory} />
      </aside>

      <section className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Assigned Referrals</h2>
          {referrals === null ? (
            <SkeletonRow />
          ) : (
            <AssignedReferrals referrals={referrals} patientNames={referralPatientNames} onCompleted={loadReferrals} />
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Your Test History</h2>
          {history === null ? (
            <SkeletonGrid />
          ) : history.length === 0 ? (
            <EmptyState icon={FlaskConical} title="No results uploaded yet" description="Results you upload will appear here." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((record, i) => (
                <div key={record.id} className="space-y-2">
                  <MedicalAssetCard record={record} index={i} />
                  <FileClaimForm patientAddress={record.patient} recordId={record.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function LaboratoryPage() {
  return (
    <RoleGuard requiredRole="Laboratory">
      <LaboratoryDashboard />
    </RoleGuard>
  );
}
