"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { uploadToIpfs } from "@/lib/ipfs";
import { RECORD_TYPES } from "@/lib/medicalRecordRegistry";

// Shared by Doctor (Consultation/Prescription) and Laboratory (LabResult/
// Imaging) dashboards: upload a file to IPFS, then mint the on-chain record
// + NFT via MedicalRecordRegistry.createRecord(). Same component either way —
// only which record types are offered differs per issuer role.
export default function CreateRecordForm({ patientAddress, allowedTypes, onCreated }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [recordType, setRecordType] = useState(allowedTypes[0]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || !patientAddress) return;

    setSubmitting(true);
    try {
      const cid = await uploadToIpfs(file);
      await runTx(() => contracts.records.createRecord(patientAddress, recordType, cid), {
        pendingLabel: "Confirm record creation in your wallet…",
        successLabel: "Medical record NFT minted",
      });
      setFile(null);
      onCreated?.();
    } catch (error) {
      console.error("Failed to create record:", error);
    } finally {
      setSubmitting(false);
    }
  }

  if (!patientAddress) {
    return <p className="text-sm text-gray-500">Select a patient with approved access first.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-sm font-medium mb-1.5">Record Type</p>
        <div className="flex flex-wrap gap-2">
          {allowedTypes.map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => setRecordType(type)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                recordType === type ? "border-brand bg-brand-pale text-brand" : "border-gray-200 hover:border-brand/40"
              }`}
            >
              {RECORD_TYPES[type]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 cursor-pointer hover:border-brand/40 transition-colors">
        <UploadCloud className="h-6 w-6 text-gray-400" />
        <span className="text-sm text-gray-500">{file ? file.name : "Click to upload the document"}</span>
        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>

      <button
        type="submit"
        disabled={!file || submitting}
        className="w-full rounded-lg bg-brand text-white px-4 py-2.5 font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
      >
        {submitting ? "Uploading & minting…" : "Upload to IPFS & Mint Record"}
      </button>
    </form>
  );
}
