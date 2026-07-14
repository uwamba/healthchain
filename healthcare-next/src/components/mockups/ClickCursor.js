"use client";

import { AnimatePresence, motion } from "framer-motion";

// A small dark "fingertip" dot that pulses over a button right as a demo
// scene simulates tapping it — the visual cue that sells "someone just
// clicked this," synced to whatever state-swap the scene does at the same
// moment. Purely decorative, positioned absolutely by the caller's own
// `relative` wrapper around the target button.
export default function ClickCursor({ active, className = "-bottom-1.5 -right-1.5" }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 0.85, 0.5] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, times: [0, 0.25, 0.7, 1] }}
          className={`pointer-events-none absolute h-5 w-5 rounded-full bg-foreground/80 border-2 border-background shadow-md z-10 ${className}`}
        />
      )}
    </AnimatePresence>
  );
}
