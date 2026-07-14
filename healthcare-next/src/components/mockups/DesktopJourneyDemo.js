"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DesktopChrome from "@/components/mockups/DesktopChrome";
import { JOURNEY_ITEMS } from "@/components/mockups/JourneyScenes";

const STEP_DURATION_MS = 4800;

// The "desktop look, simulated, animated" replacement for the old static
// step-by-step timeline: one simulated dashboard window that auto-advances
// through all 7 journey steps, crossfading between them, with a progress
// dial the viewer can also click to jump to any step directly. The caption
// below repeats the exact text the old WorkflowStep timeline showed, so
// nothing explanatory was lost in trading text-and-icon cards for a
// screen-by-screen walkthrough.
export default function DesktopJourneyDemo() {
  const [index, setIndex] = useState(0);
  const step = JOURNEY_ITEMS[index];

  useEffect(() => {
    const id = setTimeout(() => {
      setIndex((i) => (i + 1) % JOURNEY_ITEMS.length);
    }, STEP_DURATION_MS);
    return () => clearTimeout(id);
  }, [index]);

  return (
    <div className="space-y-5">
      <AnimatePresence mode="wait">
        <motion.div
          key={step.key}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <DesktopChrome url={step.url} activeRole={step.role}>
            <step.Scene />
          </DesktopChrome>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-center gap-2">
        {JOURNEY_ITEMS.map((item, i) => (
          <button
            key={item.key}
            onClick={() => setIndex(i)}
            aria-label={`Show: ${item.title}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-brand" : "w-2 bg-gray-200 hover:bg-gray-300"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-xl mx-auto space-y-2"
        >
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h3 className="font-semibold">{step.title}</h3>
            <span className="text-xs font-medium text-brand bg-brand-pale rounded-full px-2.5 py-1">{step.actor}</span>
          </div>
          <p className="text-sm text-gray-500">{step.description}</p>
          {step.actions?.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {step.actions.map((action) => (
                <span
                  key={action}
                  className="font-mono text-xs text-blockchain-purple bg-blockchain-purple-pale rounded-md px-2 py-1"
                >
                  {action}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
