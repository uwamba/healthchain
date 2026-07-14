"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Building2,
  Database,
  Fingerprint,
  HeartPulse,
  KeyRound,
  Link2,
  ShieldCheck,
  ShieldX,
  Share2,
  Users,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { ROLE, roleLabel, roleSlug } from "@/lib/identityRegistry";
import StatCard from "@/components/StatCard";
import GetStartedCTA from "@/components/GetStartedCTA";
import StepFlipCard from "@/components/StepFlipCard";
import RippleOrigin from "@/components/RippleOrigin";

const TRUST_STATS = [
  { icon: Users, label: "Healthcare Providers", value: 500, suffix: "+", accent: "brand" },
  { icon: ShieldCheck, label: "Medical Records Secured", value: 1000000, suffix: "+", accent: "green" },
  { icon: KeyRound, label: "Audit Transparency", value: 100, suffix: "%", accent: "purple" },
  { icon: ShieldX, label: "Unauthorized Access", value: "Zero", suffix: "", accent: "green" },
];

const STEPS = [
  {
    icon: Fingerprint,
    title: "Create Digital Health Identity",
    description: "Register your role on-chain — patient, doctor, hospital, lab, pharmacy, or insurer.",
  },
  {
    icon: Database,
    title: "Securely Store Medical Records",
    description: "Records live on IPFS; a verified reference and ownership NFT are minted on-chain.",
  },
  {
    icon: Share2,
    title: "Share Data Through Permission",
    description: "You approve doctor access requests for a fixed duration — 24h, 7 days, or 30 days.",
  },
  {
    icon: ShieldCheck,
    title: "Verify and Audit Every Action",
    description: "Every action is an immutable, queryable on-chain event — nothing can be quietly edited.",
  },
];

// Ripple emitters spread across the hero — each in a different brand color,
// so the propagating rings read as "the network," not one repeated shape.
const RIPPLE_ORIGINS = [
  { positionClassName: "top-[15%] left-[12%]", colorClassName: "text-brand" },
  { positionClassName: "top-[25%] right-[16%]", colorClassName: "text-blockchain-purple" },
  { positionClassName: "bottom-[12%] left-[45%]", colorClassName: "text-medical-green" },
];

// Small floating icon badges layered into the hero, purely decorative — the
// second, independent animation on top of the ripple background.
const FLOATING_BADGES = [
  { icon: HeartPulse, className: "top-8 left-[8%] bg-medical-green-pale text-medical-green", duration: 5, delay: 0 },
  { icon: Link2, className: "top-4 right-[10%] bg-blockchain-purple-pale text-blockchain-purple", duration: 6, delay: 0.8 },
  { icon: ShieldCheck, className: "bottom-10 left-[14%] bg-brand-pale text-brand", duration: 5.5, delay: 1.4 },
  { icon: Database, className: "bottom-6 right-[16%] bg-blockchain-purple-pale text-blockchain-purple", duration: 6.5, delay: 0.4 },
];

const FOOTER_BLURBS = [
  {
    icon: Building2,
    accent: "text-brand",
    text: "Hospitals manage doctors, records, and blockchain activity from one enterprise dashboard.",
  },
  {
    icon: Share2,
    accent: "text-medical-green",
    text: "Doctors request access; only the patient can approve, deny, or revoke it.",
  },
  {
    icon: ShieldCheck,
    accent: "text-blockchain-purple",
    text: "Every record is a verified NFT, every action an immutable, auditable event.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { account, role } = useWallet();
  const isRegistered = account && role !== ROLE.None;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Section 1 — hero: full-bleed, ~50% shorter, ripple background + floating badges */}
      <section className="hero-band shrink-0 min-h-[50vh] flex items-center">
        {RIPPLE_ORIGINS.map((origin, i) => (
          <RippleOrigin key={i} {...origin} />
        ))}

        {FLOATING_BADGES.map(({ icon: Icon, className, duration, delay }, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -14, 0] }}
            transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
            className={`hidden sm:flex absolute h-11 w-11 rounded-full items-center justify-center shadow-sm ${className}`}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </motion.div>
        ))}

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col items-center gap-4 text-center w-full">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-2xl sm:text-4xl font-bold tracking-tight max-w-3xl"
          >
            Your Health Data. <span className="text-brand">Your Ownership.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="text-base sm:text-lg text-gray-500 max-w-xl"
          >
            Secure decentralized healthcare powered by blockchain technology.
          </motion.p>

          {isRegistered ? (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              onClick={() => router.push(`/${roleSlug(role)}`)}
              className="rounded-lg bg-brand text-white px-6 py-3 font-medium hover:bg-brand-light transition-colors"
            >
              Go to your {roleLabel(role)} Dashboard
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              className="flex flex-wrap justify-center gap-3"
            >
              <a
                href="#get-started"
                className="rounded-lg bg-brand text-white px-6 py-3 font-medium hover:bg-brand-light transition-colors"
              >
                Get Started
              </a>
              <a
                href="#how-it-works"
                className="rounded-lg border border-gray-200 px-6 py-3 font-medium hover:bg-gray-50 transition-colors"
              >
                Explore Ecosystem
              </a>
            </motion.div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 w-full">
            {TRUST_STATS.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      {/* Section 2 — how it works + register: plain white/background band (same
          surface as sections 1 and 3, no separate tint) that grows (flex-1) to
          fill exactly the space left between the hero and footer within the
          page's min-h-screen flex column; content itself framed in its own
          (glass) panel for visual structure */}
      <section
        id="how-it-works"
        className="bg-background scroll-mt-16 flex-1 flex items-center py-16 sm:py-20"
      >
        {/* Alignment wrapper — identical mx-auto max-w-6xl px-4 sm:px-6 as the
            hero and footer sections, so the glass card's edges land on the
            same margin as the StatCards/footer cards, not a compounded one. */}
        <div className="mx-auto max-w-6xl w-full px-4 sm:px-6">
        <div className="glass rounded-3xl p-6 sm:p-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-12">How HealthChain Works</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <StepFlipCard key={step.title} index={i} {...step} />
            ))}
          </div>

          <div id="get-started" className="mt-16 flex flex-col items-center gap-6 scroll-mt-20">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-semibold mb-2">
                {isRegistered ? "You're all set" : "Create your digital health identity"}
              </h3>
              <p className="text-gray-500 max-w-md">
                {isRegistered
                  ? "Your wallet is already registered on-chain."
                  : "One on-chain registration unlocks your role's dashboard — no separate accounts or passwords."}
              </p>
            </div>
            {!isRegistered && <GetStartedCTA />}
          </div>
        </div>
        </div>
      </section>

      {/* Section 3 — ecosystem footer */}
      <section className="shrink-0 mx-auto max-w-6xl px-4 sm:px-6 py-20 grid sm:grid-cols-3 gap-6">
        {FOOTER_BLURBS.map(({ icon: Icon, accent, text }, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.08 }}
            className="glass rounded-2xl p-6 flex flex-col items-center gap-3 text-center text-sm text-gray-500"
          >
            <Icon className={`h-6 w-6 ${accent}`} />
            <p>{text}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
