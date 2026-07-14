"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, FileHeart, FlaskConical, Link2, Pill, Scan, Stethoscope, Syringe } from "lucide-react";
import { recordTypeLabel, recordStatusLabel } from "@/lib/medicalRecordRegistry";
import { resolveIpfsUrl } from "@/lib/ipfs";
import EmptyState from "@/components/EmptyState";

// Shared vertical timeline used by both Patient and Doctor dashboards — same
// component, different data passed in (a doctor only ever sees it once
// AccessControlRegistry.hasAccess() is true for that patient).
const TYPE_ICON = {
  0: Stethoscope, // Consultation
  1: FlaskConical, // LabResult
  2: Pill, // Prescription
  3: Scan, // Imaging
  4: FileHeart, // Discharge
  5: Syringe, // Vaccination
};

export default function RecordTimeline({ records, issuerNames = {} }) {
  const [expandedId, setExpandedId] = useState(null);

  if (records.length === 0) {
    return <EmptyState icon={FileHeart} title="No medical records yet" description="Records created by an issuer will appear here in order." />;
  }

  const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="relative pl-8">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-blockchain-purple/30" />
      <div className="space-y-4">
        {sorted.map((record, i) => {
          const Icon = TYPE_ICON[record.recordType] ?? FileHeart;
          const expanded = expandedId === record.id;

          return (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.05 }}
              className="relative"
            >
              <div className="absolute -left-8 top-0.5 h-8 w-8 rounded-full bg-blockchain-purple-pale text-blockchain-purple flex items-center justify-center">
                <Icon className="h-4 w-4" />
              </div>

              <button
                onClick={() => setExpandedId(expanded ? null : record.id)}
                className="glass w-full text-left rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium">{recordTypeLabel(record.recordType)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(record.createdAt * 1000).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>

              {expanded && (
                <div className="glass mt-1 rounded-xl p-4 text-sm space-y-1.5 border-t-0">
                  <p>
                    Issuer:{" "}
                    <span className="font-medium">
                      {issuerNames[record.issuer] || `${record.issuer.slice(0, 6)}…${record.issuer.slice(-4)}`}
                    </span>
                  </p>
                  <p>Status: {recordStatusLabel(record.status)}</p>
                  <p className="font-mono text-xs text-gray-500">Token #{record.tokenId}</p>
                  <a
                    href={resolveIpfsUrl(record.ipfsCid)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blockchain-purple hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    View on IPFS
                  </a>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
