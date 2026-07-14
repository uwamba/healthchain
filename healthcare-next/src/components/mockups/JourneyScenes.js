"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import useDemoCycle from "@/components/mockups/useDemoCycle";
import ClickCursor from "@/components/mockups/ClickCursor";
import { CheckInScene, PharmacyDispenseScene, InsuranceClaimScene } from "@/components/mockups/DemoScenes";

// The 7 scenes that back the full-journey desktop carousel
// (DesktopJourneyDemo). Two are reused verbatim from DemoScenes (Pharmacy,
// Insurance — already desktop-appropriate); the rest are new, sized for the
// wider desktop content pane. Same auto-looping click pattern throughout.

const fade = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.25, ease: "easeOut" },
};

const ROLES = ["Patient", "Doctor", "Hospital", "Laboratory", "Pharmacy", "Insurer"];

function RegisterScene() {
  const clicked = useDemoCycle({ offset: 1800 });

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!clicked ? (
          <motion.div key="form" {...fade} className="space-y-3">
            <p className="text-xs font-medium text-gray-500">Create Your Digital Health Identity</p>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <span
                  key={r}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium border ${
                    r === "Patient" ? "border-brand bg-brand-pale text-brand" : "border-gray-200 text-gray-400"
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-400">Full name</div>
            <div className="relative">
              <button className="w-full rounded-lg bg-brand text-white px-3 py-2 text-xs font-medium">Register</button>
              <ClickCursor active={clicked} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="done" {...fade} className="flex flex-col items-center gap-2 py-8">
            <CheckCircle2 className="h-9 w-9 text-medical-green" />
            <p className="font-medium text-sm">Registered as Patient</p>
            <p className="text-xs text-gray-500">One on-chain identity — no separate account or password</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DoctorAccessScene() {
  const clicked = useDemoCycle({ offset: 1900 });

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Doctor Dashboard</p>
        <div className="glass rounded-lg p-3 space-y-2">
          <p className="font-medium text-sm">Sarah M.</p>
          <div className="relative">
            <button
              disabled={clicked}
              className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-medium transition-transform ${
                clicked ? "scale-95 bg-gray-200 text-gray-400" : "bg-brand text-white"
              }`}
            >
              {clicked ? "Sent" : "Request Access"}
            </button>
            <ClickCursor active={clicked} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Patient Dashboard</p>
        <AnimatePresence mode="wait">
          {!clicked ? (
            <motion.div key="empty" {...fade} className="glass rounded-lg p-3">
              <p className="text-xs text-gray-400">No pending requests</p>
            </motion.div>
          ) : (
            <motion.div key="request" {...fade} className="glass rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-medium text-xs">Dr. Alex Kim</p>
                <span className="text-[10px] font-medium text-brand bg-brand-pale rounded-full px-1.5 py-0.5">
                  Doctor
                </span>
              </div>
              <button className="w-full rounded-lg bg-medical-green text-white px-2 py-1 text-[11px] font-medium">
                Approve
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CreateRecordScene() {
  const clicked = useDemoCycle({ offset: 1800 });

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!clicked ? (
          <motion.div key="form" {...fade} className="space-y-3">
            <p className="text-xs font-medium text-gray-500">Create Prescription / Consultation Note</p>
            <span className="inline-block rounded-full px-2.5 py-1 text-xs font-medium border border-brand bg-brand-pale text-brand">
              Prescription
            </span>
            <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-400 h-12">
              Amoxicillin 500mg, twice daily…
            </div>
            <div className="relative">
              <button className="w-full rounded-lg bg-brand text-white px-3 py-2 text-xs font-medium">Create Record</button>
              <ClickCursor active={clicked} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="done" {...fade} className="flex flex-col items-center gap-2 py-8">
            <CheckCircle2 className="h-9 w-9 text-medical-green" />
            <p className="font-medium text-sm">Record #128 Created</p>
            <p className="text-xs text-gray-500">Minted as an NFT owned by the patient</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReferLabScene() {
  const clicked = useDemoCycle({ offset: 1800 });

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!clicked ? (
          <motion.div key="form" {...fade} className="space-y-3">
            <p className="text-xs font-medium text-gray-500">Refer to Lab</p>
            <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono text-gray-400">
              0xC1a2…9bD4
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-400">
              Reason: Bloodwork panel
            </div>
            <div className="relative">
              <button className="w-full rounded-lg bg-brand text-white px-3 py-2 text-xs font-medium">Refer to Lab</button>
              <ClickCursor active={clicked} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="done" {...fade} className="flex flex-col items-center gap-2 py-8">
            <CheckCircle2 className="h-9 w-9 text-medical-green" />
            <p className="font-medium text-sm">Referral Sent</p>
            <p className="text-xs text-gray-500">Awaiting the patient&rsquo;s approval to send it to the lab</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const JOURNEY_ITEMS = [
  {
    key: "register",
    role: null,
    url: "healthchain.app",
    title: "Create a digital health identity",
    actor: "Everyone, once",
    actions: ["register(role, name)"],
    description:
      "One on-chain registration per wallet — patient, doctor, hospital, laboratory, pharmacy, or insurer. Your role is a verified on-chain fact, never a settings toggle.",
    Scene: RegisterScene,
  },
  {
    key: "checkin",
    role: "hospital",
    url: "hospital.healthchain.app",
    title: "Hospital check-in",
    actor: "Hospital → Patient approves",
    actions: ["requestVisit(patient)", "approveVisit(visitId)"],
    description:
      "The hospital starts a visit and shows a QR. The patient scans it with their own phone and taps Confirm — a real transaction their own wallet signs.",
    Scene: CheckInScene,
  },
  {
    key: "access",
    role: "doctor",
    url: "doctor.healthchain.app",
    title: "Doctor requests access",
    actor: "Doctor → Patient approves",
    actions: ["requestAccess(patient)", "approveAccess(doctor, duration)"],
    description:
      "Being checked in never grants a doctor anything by itself. The doctor requests access, and only the patient's own approval unlocks it — 24 hours, 7 days, or 30 days, revocable anytime.",
    Scene: DoctorAccessScene,
  },
  {
    key: "record",
    role: "doctor",
    url: "doctor.healthchain.app",
    title: "Diagnosis & prescription",
    actor: "Doctor",
    actions: ["createRecord(patient, type, ipfsCid)"],
    description:
      "Once access is granted, the doctor's notes and prescriptions are minted as a Medical Record NFT owned by the patient.",
    Scene: CreateRecordScene,
  },
  {
    key: "referral",
    role: "doctor",
    url: "doctor.healthchain.app",
    title: "Lab referral (if needed)",
    actor: "Doctor → Patient approves twice",
    actions: ["createReferral()", "approveReferral()", "completeReferral()", "approveReferralResult()"],
    description:
      "The patient approves sending the referral, the lab uploads the result, and the patient separately approves sharing that result back with the doctor.",
    Scene: ReferLabScene,
  },
  {
    key: "pharmacy",
    role: "pharmacy",
    url: "pharmacy.healthchain.app",
    title: "Pharmacy",
    actor: "Patient shows QR, or Pharmacy requests access",
    actions: ["dispensePrescription(recordId)"],
    description:
      "Either the patient shows their prescription's QR for a quick dispense, or the pharmacy requests access and dispenses from their approved patient list.",
    Scene: PharmacyDispenseScene,
  },
  {
    key: "claim",
    role: "insurer",
    url: "insurer.healthchain.app",
    title: "Insurance claim",
    actor: "Provider files → Patient approves visibility",
    actions: ["submitClaim()", "approvePatientVisibility()", "approveClaim()"],
    description:
      "Invisible to the insurer until the patient approves it, and only visible for a 30-day window after that before the patient must renew it.",
    Scene: InsuranceClaimScene,
  },
];
