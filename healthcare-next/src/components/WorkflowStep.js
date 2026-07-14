"use client";

import { motion } from "framer-motion";

// One entry in the full patient-journey timeline — same visual language as
// RecordTimeline's vertical rail (blockchain-purple connector + icon medallion),
// extended with an "actor" badge and mono on-chain action chips so a reader
// can see at a glance who does the clicking and what actually gets signed.
export default function WorkflowStep({ index, icon: Icon, title, actor, actions = [], description, last = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.06 }}
      className={`relative pl-16 ${last ? "" : "pb-8"}`}
    >
      {!last && <div className="absolute left-[23px] top-12 bottom-0 w-px bg-blockchain-purple/30" />}
      <div className="absolute left-0 top-0 h-12 w-12 rounded-full bg-blockchain-purple-pale text-blockchain-purple flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>

      <div className="glass rounded-2xl p-5 space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs font-medium text-brand bg-brand-pale rounded-full px-2.5 py-1 shrink-0">{actor}</span>
        </div>
        <p className="text-sm text-gray-500">{description}</p>
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {actions.map((action, i) => (
              <span key={action} className="flex items-center gap-2">
                <span className="font-mono text-xs text-blockchain-purple bg-blockchain-purple-pale rounded-md px-2 py-1">
                  {action}
                </span>
                {i < actions.length - 1 && <span className="text-gray-300 text-xs">→</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
