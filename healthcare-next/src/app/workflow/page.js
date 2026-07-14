"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  FileSignature,
  FlaskConical,
  HeartPulse,
  Pill,
  QrCode,
  ShieldCheck,
  ShieldQuestion,
  Stethoscope,
  UserCheck,
  UserPlus,
} from "lucide-react";
import WorkflowStep from "@/components/WorkflowStep";
import RoleCapabilityCard from "@/components/RoleCapabilityCard";

// The full, concrete patient journey — mirrors docs/WORKFLOWS.md, rendered
// as a guided visual timeline instead of a markdown doc. Kept as page-level
// data (not fetched) since this is documentation, not on-chain state.
const JOURNEY_STEPS = [
  {
    icon: UserPlus,
    title: "Create a digital health identity",
    actor: "Everyone, once",
    actions: ["register(role, name)"],
    description:
      "One on-chain registration per wallet — patient, doctor, hospital, laboratory, pharmacy, or insurer. This is the only account you ever need; your role is a verified on-chain fact, never a settings toggle.",
  },
  {
    icon: Building2,
    title: "Hospital check-in",
    actor: "Hospital → Patient approves",
    actions: ["requestVisit(patient)", "approveVisit(visitId)"],
    description:
      "The hospital starts a visit for a walked-in patient and shows a QR. The patient scans it with their own phone and taps Confirm — a real transaction their own wallet signs, not a front-desk override.",
  },
  {
    icon: Stethoscope,
    title: "Doctor requests access",
    actor: "Doctor → Patient approves",
    actions: ["requestAccess(patient)", "approveAccess(doctor, duration)"],
    description:
      "Being checked in never grants a doctor anything by itself. The doctor still has to request access, and the patient still has to approve it — for 24 hours, 7 days, or 30 days, revocable anytime.",
  },
  {
    icon: FileSignature,
    title: "Diagnosis & prescription",
    actor: "Doctor",
    actions: ["createRecord(patient, type, ipfsCid)"],
    description:
      "Once access is granted, the doctor's consultation notes and prescriptions are minted as a Medical Record NFT owned by the patient — it shows up on their Medical Assets grid immediately.",
  },
  {
    icon: FlaskConical,
    title: "Lab referral (if needed)",
    actor: "Doctor → Patient approves twice",
    actions: ["createReferral()", "approveReferral()", "completeReferral()", "approveReferralResult()"],
    description:
      "The doctor refers the patient to a lab; the patient approves sending the referral, the lab uploads the result, and the patient separately approves sharing that result back with the doctor.",
  },
  {
    icon: Pill,
    title: "Pharmacy",
    actor: "Patient shows QR, or Pharmacy requests access",
    actions: ["dispensePrescription(recordId)"],
    description:
      "Either the patient shows their prescription's QR for a quick one-off dispense, or the pharmacy looks the patient up, requests access (same request-and-approve pattern as a doctor), and dispenses from their approved patient list.",
  },
  {
    icon: ShieldCheck,
    title: "Insurance claim",
    actor: "Provider files → Patient approves visibility",
    actions: ["submitClaim()", "approvePatientVisibility()", "approveClaim()"],
    description:
      "The pharmacy or lab files a claim for services it rendered — invisible to the insurer until the patient approves it, and only visible for a 30-day window after that before the patient must renew it.",
    last: true,
  },
];

const ROLE_CARDS = [
  {
    icon: HeartPulse,
    role: "Patient",
    accent: "green",
    capabilities: [
      "Approve or deny every access request — doctors, pharmacies, referrals, claims",
      "Revoke a doctor's or pharmacy's access early, anytime",
      "See a full activity log of every on-chain action involving you",
      "Always see your own complete record history",
    ],
  },
  {
    icon: Stethoscope,
    role: "Doctor",
    accent: "brand",
    capabilities: [
      "See patients checked in and assigned to you at a hospital",
      "Request access to any patient by address — once approved, no need to search again",
      "Create consultation and prescription records",
      "Refer a patient to a lab",
    ],
  },
  {
    icon: Building2,
    role: "Hospital",
    accent: "purple",
    capabilities: [
      "Check a walked-in patient in and assign them to a doctor",
      "Confirm a doctor's affiliation request",
      "View network-wide activity and analytics",
    ],
  },
  {
    icon: FlaskConical,
    role: "Laboratory",
    accent: "green",
    capabilities: [
      "Create lab result and imaging records directly for a patient",
      "See and complete referrals assigned to your lab",
      "File insurance claims for results you issued",
    ],
  },
  {
    icon: Pill,
    role: "Pharmacy",
    accent: "brand",
    capabilities: [
      "Scan a prescription QR and dispense it on the spot",
      "Or request access to a patient and dispense from your approved list",
      "Batch several dispensed prescriptions into one insurance claim per patient",
    ],
  },
  {
    icon: ShieldCheck,
    role: "Insurer",
    accent: "purple",
    capabilities: [
      "See claims only once the patient approves visibility",
      "Cross-check attached records against the chain before approving",
      "Approve or reject — full detail fades after 30 days unless renewed",
    ],
  },
];

const CONSENT_STEPS = [
  { icon: ShieldQuestion, label: "Provider Requests", detail: "Doctor or pharmacy asks for access" },
  { icon: UserCheck, label: "Patient Approves", detail: "From their own wallet, own device" },
  { icon: ShieldCheck, label: "Access Granted", detail: "Time-boxed, revocable anytime" },
];

export default function WorkflowPage() {
  return (
    <div className="min-h-screen">
      <section className="hero-band py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-2xl sm:text-4xl font-bold tracking-tight"
          >
            How The System Works
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="text-base sm:text-lg text-gray-500 mt-3 max-w-2xl mx-auto"
          >
            Every action that matters — access, referrals, claims — is a real transaction the affected patient signs
            themselves. QR codes are only a fast way to reach the right screen; they never bypass that signature.
          </motion.p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-14 sm:py-16">
        <div className="glass rounded-3xl p-6 sm:p-10">
          <h2 className="text-xl sm:text-2xl font-semibold text-center mb-2">The One Rule Behind Everything</h2>
          <p className="text-sm text-gray-500 text-center max-w-xl mx-auto mb-8">
            This same three-step pattern repeats for hospital check-ins, doctor access, lab referrals, and insurance
            claims — only the data changes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {CONSENT_STEPS.map(({ icon: Icon, label, detail }, i) => (
              <div key={label} className="flex items-center gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.12 }}
                  className="flex flex-col items-center text-center gap-2 w-44"
                >
                  <div className="h-12 w-12 rounded-full bg-brand-pale text-brand flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-gray-500">{detail}</p>
                </motion.div>
                {i < CONSENT_STEPS.length - 1 && (
                  <ArrowRight className="hidden sm:block h-5 w-5 text-gray-300 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-4 sm:py-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-center mb-10">The Full Patient Journey</h2>
        <div>
          {JOURNEY_STEPS.map((step, i) => (
            <WorkflowStep key={step.title} index={i} {...step} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-xl sm:text-2xl font-semibold text-center mb-2">Every Role, At a Glance</h2>
        <p className="text-sm text-gray-500 text-center max-w-xl mx-auto mb-10">
          What each role can actually do once registered — and, just as importantly, what still requires someone
          else&rsquo;s signature.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLE_CARDS.map((card, i) => (
            <RoleCapabilityCard key={card.role} index={i} {...card} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-20">
        <div className="flex items-center gap-3 glass rounded-2xl p-5">
          <QrCode className="h-6 w-6 text-blockchain-purple shrink-0" />
          <p className="text-sm text-gray-500">
            Every QR code you&rsquo;ll see in this app encodes a link to an already-existing on-chain request —
            scanning it opens your own dashboard with that item ready to approve. It&rsquo;s a shortcut to the right
            screen, not a way around your wallet&rsquo;s signature.
          </p>
        </div>
      </section>
    </div>
  );
}
