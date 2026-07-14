"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clock, Link2, QrCode, ShieldOff } from "lucide-react";
import { recordTypeLabel } from "@/lib/medicalRecordRegistry";
import { resolveIpfsUrl } from "@/lib/ipfs";

// The single component that makes records "feel like owned assets" rather
// than files in a list — every dashboard that shows a MedicalRecordRegistry
// entry (Patient, Doctor, Laboratory, Pharmacy) renders it through this.
const STATUS_META = {
  0: { label: "Verified", icon: CheckCircle2, className: "text-medical-green bg-medical-green-pale" }, // Active
  1: { label: "Dispensed", icon: Clock, className: "text-brand bg-brand-pale" },
  2: { label: "Revoked", icon: ShieldOff, className: "text-gray-500 bg-gray-100" },
};

const PRESCRIPTION_TYPE = 2;
const ACTIVE_STATUS = 0;

export default function MedicalAssetCard({ record, issuerName, index = 0, onShareAccess }) {
  const [showQr, setShowQr] = useState(false);
  const status = STATUS_META[record.status] ?? STATUS_META[0];
  const StatusIcon = status.icon;
  const isDispensablePrescription = record.recordType === PRESCRIPTION_TYPE && record.status === ACTIVE_STATUS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.06 }}
      className="glass rounded-2xl p-5 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{recordTypeLabel(record.recordType)}</p>
          <p className="text-xs text-gray-500 font-mono">Token #{record.tokenId}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </div>

      <div className="text-sm text-gray-500 space-y-1">
        <p>
          Issued by: <span className="font-medium text-foreground">{issuerName || truncateAddress(record.issuer)}</span>
        </p>
        <p>{new Date(record.createdAt * 1000).toLocaleDateString()}</p>
      </div>

      <a
        href={resolveIpfsUrl(record.ipfsCid)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-blockchain-purple hover:underline w-fit"
      >
        <Link2 className="h-3.5 w-3.5" />
        IPFS Encrypted Storage
      </a>

      {showQr && isDispensablePrescription && (
        <div className="flex justify-center py-2">
          <QRCodeSVG value={JSON.stringify({ recordId: record.id })} size={140} />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <a
          href={resolveIpfsUrl(record.ipfsCid)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 text-center rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          View
        </a>
        {isDispensablePrescription && (
          <button
            onClick={() => setShowQr((v) => !v)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-medical-green text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-colors"
          >
            <QrCode className="h-4 w-4" />
            {showQr ? "Hide QR" : "Show QR"}
          </button>
        )}
        {onShareAccess && (
          <button
            onClick={onShareAccess}
            className="flex-1 rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:bg-brand-light transition-colors"
          >
            Share Access
          </button>
        )}
      </div>
    </motion.div>
  );
}

function truncateAddress(address) {
  if (!address) return "Unknown";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
