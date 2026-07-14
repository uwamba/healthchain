"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

// Shared by the landing page's trust stats ("500+ Healthcare Providers" etc.)
// and every dashboard's top stat row (patients today, doctors online, ...) —
// one component so the "count-up on scroll/mount" feel is consistent everywhere.
export default function StatCard({ icon: Icon, label, value, suffix = "", accent = "brand" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [displayValue, setDisplayValue] = useState(0);

  const numericValue = typeof value === "number" ? value : parseFloat(value) || 0;

  useEffect(() => {
    if (!isInView) return;
    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(numericValue * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [isInView, numericValue]);

  const accentClass = {
    brand: "text-brand",
    green: "text-medical-green",
    purple: "text-blockchain-purple",
  }[accent];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass rounded-2xl p-5 flex flex-col gap-2"
    >
      {Icon && <Icon className={`h-5 w-5 ${accentClass}`} />}
      <span className={`text-3xl font-bold ${accentClass}`}>
        {typeof value === "number" || !isNaN(parseFloat(value)) ? displayValue.toLocaleString() : value}
        {suffix}
      </span>
      <span className="text-sm text-gray-500">{label}</span>
    </motion.div>
  );
}
