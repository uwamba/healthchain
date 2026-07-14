"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const ACCENTS = {
  brand: { bg: "bg-brand-pale", text: "text-brand" },
  green: { bg: "bg-medical-green-pale", text: "text-medical-green" },
  purple: { bg: "bg-blockchain-purple-pale", text: "text-blockchain-purple" },
};

// One role's "what can I do" summary — capabilities always pair a
// (colorblind-safe) check icon with text, never color alone, matching the
// status-pill convention used across every dashboard in this app.
export default function RoleCapabilityCard({ index, icon: Icon, role, accent = "brand", capabilities }) {
  const { bg, text } = ACCENTS[accent] ?? ACCENTS.brand;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.06 }}
      className="glass rounded-2xl p-5 space-y-3"
    >
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${bg} ${text}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{role}</h3>
      <ul className="space-y-1.5 text-sm text-gray-500">
        {capabilities.map((capability) => (
          <li key={capability} className="flex gap-2">
            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${text}`} />
            <span>{capability}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
