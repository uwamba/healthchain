"use client";

import { motion } from "framer-motion";

// Hover/focus flips the card to reveal the description — front stays clean
// (number + icon + title only), back carries the explanatory copy. Falls
// back gracefully on touch devices since the front already states the title.
export default function StepFlipCard({ index, icon: Icon, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.08 }}
      tabIndex={0}
      className="flip-card h-56 outline-none"
    >
      <div className="flip-card-inner">
        <div className="flip-card-front rounded-2xl p-5 flex flex-col gap-3 bg-background border border-brand/10 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-full bg-blockchain-purple-pale text-blockchain-purple flex items-center justify-center font-semibold text-sm">
              {index + 1}
            </div>
            {Icon && <Icon className="h-5 w-5 text-brand" />}
          </div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-gray-400 mt-auto">Hover to see how</p>
        </div>

        <div className="flip-card-back rounded-2xl p-5 flex flex-col justify-center bg-brand text-white shadow-sm">
          <p className="text-xs font-medium text-white/70 mb-1.5">Step {index + 1}</p>
          <p className="text-sm text-white/95">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
