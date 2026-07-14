"use client";

import { useState } from "react";
import { FlaskConical, UploadCloud } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { uploadToIpfs } from "@/lib/ipfs";
import EmptyState from "@/components/EmptyState";

const LAB_RESULT_TYPE = 1; // RecordType.LabResult

// Referrals approved by the patient and assigned to this lab
// (ReferralRegistry status Approved). Uploading a result here does both
// steps in one flow: mint the normal LabResult record (same
// MedicalRecordRegistry.createRecord path as the standalone Laboratory
// upload form), then tag it to the referral via completeReferral so the
// patient sees "ready to share back with your doctor."
export default function AssignedReferrals({ referrals, patientNames, onCompleted }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [fileByReferral, setFileByReferral] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  async function complete(referral) {
    const file = fileByReferral[referral.id];
    if (!file) return;

    setSubmittingId(referral.id);
    try {
      const cid = await uploadToIpfs(file);
      const receipt = await runTx(
        () => contracts.records.createRecord(referral.patient, LAB_RESULT_TYPE, cid),
        { pendingLabel: "Minting result record…", successLabel: "Result recorded" }
      );
      const createdEvent = receipt.events?.find((e) => e.event === "RecordCreated");
      const recordId = createdEvent?.args?.id?.toNumber();

      await runTx(() => contracts.referral.completeReferral(referral.id, recordId), {
        pendingLabel: "Linking result to referral…",
        successLabel: "Referral completed — waiting on patient to share it with the doctor",
      });

      setFileByReferral((prev) => ({ ...prev, [referral.id]: null }));
      onCompleted?.();
    } catch (error) {
      console.error("Failed to complete referral:", error);
    } finally {
      setSubmittingId(null);
    }
  }

  if (referrals.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No assigned referrals"
        description="Referrals a patient has approved for your lab will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {referrals.map((referral) => (
        <div key={referral.id} className="glass rounded-2xl p-4 space-y-3">
          <div>
            <p className="font-medium text-sm">{patientNames[referral.patient] || "Patient"}</p>
            <p className="text-xs text-gray-500">{referral.reason || "No reason given"}</p>
          </div>
          <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 py-5 cursor-pointer hover:border-brand/40 transition-colors">
            <UploadCloud className="h-5 w-5 text-gray-400" />
            <span className="text-xs text-gray-500">
              {fileByReferral[referral.id]?.name || "Click to upload the result"}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={(e) =>
                setFileByReferral((prev) => ({ ...prev, [referral.id]: e.target.files?.[0] ?? null }))
              }
            />
          </label>
          <button
            onClick={() => complete(referral)}
            disabled={!fileByReferral[referral.id] || submittingId === referral.id}
            className="w-full rounded-lg bg-brand text-white px-3 py-2 text-sm font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
          >
            {submittingId === referral.id ? "Uploading & completing…" : "Upload Result & Complete Referral"}
          </button>
        </div>
      ))}
    </div>
  );
}
