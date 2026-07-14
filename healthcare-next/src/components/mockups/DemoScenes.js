"use client";

import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clock, Pill, Search, ShieldCheck } from "lucide-react";
import useDemoCycle from "@/components/mockups/useDemoCycle";
import ClickCursor from "@/components/mockups/ClickCursor";

// Static, hand-built recreations of real screens — hardcoded example data,
// no wallet/contract calls — used only to illustrate the workflow on the
// marketing/explainer page. Each auto-loops through a before/after "click"
// via useDemoCycle, so a passive viewer actually sees the action happen
// (button pulses, a cursor dot taps it, the result state fades in) instead
// of a frozen screenshot. Styled to match the real dashboards (same status
// pills, buttons, badges) so they read as authentic screens.

const fade = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.25, ease: "easeOut" },
};

export function CheckInScene() {
  const clicked = useDemoCycle({ offset: 900 });

  return (
    <div className="flex flex-col items-center gap-3 flex-1 justify-center">
      <AnimatePresence mode="wait">
        {!clicked ? (
          <motion.div key="ready" {...fade} className="flex flex-col items-center gap-3 w-full">
            <p className="text-xs text-gray-500 text-center">Show this to hospital front-desk staff</p>
            <div className="bg-white p-2.5 rounded-xl">
              <QRCodeSVG value="healthchain-demo-visit" size={120} />
            </div>
            <p className="font-medium text-sm">Checking in at General Hospital</p>
          </motion.div>
        ) : (
          <motion.div key="done" {...fade} className="flex flex-col items-center gap-2 py-8">
            <CheckCircle2 className="h-9 w-9 text-medical-green" />
            <p className="font-medium text-sm">Checked In</p>
            <p className="text-xs text-gray-500">Waiting to be assigned a doctor</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full">
        <button
          className={`w-full rounded-lg bg-brand text-white px-3 py-2 text-xs font-medium transition-transform ${clicked ? "scale-95" : "scale-100"}`}
        >
          Confirm Check-In
        </button>
        <ClickCursor active={clicked} />
      </div>
    </div>
  );
}

export function DoctorRequestScene() {
  const clicked = useDemoCycle({ offset: 1300 });

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500">Patient Lookup</p>
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono text-gray-400">
          0xA4c9…3fE1
        </div>
        <div className="rounded-lg bg-brand text-white p-2">
          <Search className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="glass rounded-xl p-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm">Sarah M.</p>
          <AnimatePresence mode="wait">
            {!clicked ? (
              <motion.p key="idle" {...fade} className="text-xs text-gray-500">
                No access yet
              </motion.p>
            ) : (
              <motion.p key="sent" {...fade} className="text-xs text-amber-600 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Waiting on patient
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="relative shrink-0">
          <button
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-transform ${
              clicked ? "scale-95 bg-gray-200 text-gray-400" : "scale-100 bg-brand text-white"
            }`}
          >
            {clicked ? "Sent" : "Request Access"}
          </button>
          <ClickCursor active={clicked} />
        </div>
      </div>
    </div>
  );
}

export function PatientApproveScene() {
  const clicked = useDemoCycle({ offset: 1700 });

  return (
    <div className="relative space-y-3 flex-1">
      <AnimatePresence mode="wait">
        {!clicked ? (
          <motion.div key="pending" {...fade} className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">Dr. Alex Kim</p>
              <span className="text-[11px] font-medium text-brand bg-brand-pale rounded-full px-2 py-0.5">Doctor</span>
            </div>
            <p className="font-mono text-[11px] text-gray-500">0xA4c9…3fE1</p>
            <div>
              <p className="text-[11px] text-gray-500 mb-1.5">Access Duration</p>
              <div className="flex gap-1.5">
                {["24h", "7d", "30d"].map((label, i) => (
                  <span
                    key={label}
                    className={`flex-1 text-center rounded-lg border px-1.5 py-1 text-[11px] font-medium ${
                      i === 1 ? "border-brand bg-brand-pale text-brand" : "border-gray-200 text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-400">
                Deny
              </button>
              <button className="flex-1 rounded-lg bg-medical-green text-white px-2 py-1.5 text-xs font-medium">
                Approve
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="approved" {...fade} className="flex flex-col items-center gap-2 py-10">
            <CheckCircle2 className="h-9 w-9 text-medical-green" />
            <p className="font-medium text-sm">Access Approved</p>
            <p className="text-xs text-gray-500">Expires in 7 days</p>
          </motion.div>
        )}
      </AnimatePresence>
      <ClickCursor active={clicked} className="bottom-9 right-3" />
    </div>
  );
}

export function PharmacyDispenseScene() {
  const clicked = useDemoCycle({ offset: 2100 });

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-medical-green">
        <CheckCircle2 className="h-4 w-4" />
        <p className="font-semibold text-sm">Valid Prescription</p>
      </div>
      <div className="text-xs space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-500">Doctor</span>
          <span className="font-medium">Dr. Alex Kim</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Status</span>
          <AnimatePresence mode="wait">
            {!clicked ? (
              <motion.span key="active" {...fade} className="font-medium text-medical-green">
                Active
              </motion.span>
            ) : (
              <motion.span key="dispensed" {...fade} className="font-medium text-gray-400">
                Dispensed
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="relative">
        <button
          disabled={clicked}
          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-transform ${
            clicked ? "scale-95 bg-gray-200 text-gray-400" : "scale-100 bg-brand text-white"
          }`}
        >
          <Pill className="h-3.5 w-3.5" />
          {clicked ? "Dispensed" : "Dispense Medication"}
        </button>
        <ClickCursor active={clicked} />
      </div>
    </div>
  );
}

export function InsuranceClaimScene() {
  const clicked = useDemoCycle({ offset: 2500 });

  return (
    <div className="relative glass rounded-xl p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm">Sarah M.</p>
          <p className="text-xs text-gray-500">From MedPlus Pharmacy</p>
        </div>
        <AnimatePresence mode="wait">
          {!clicked ? (
            <motion.span key="pending" {...fade} className="text-xs text-gray-400">
              Pending
            </motion.span>
          ) : (
            <motion.span key="approved" {...fade} className="text-xs text-medical-green font-medium">
              Approved
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p className="text-sm text-gray-600">Dispensed medication</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Amount: 5,000</span>
        <span className="flex items-center gap-1 text-medical-green">
          <ShieldCheck className="h-3.5 w-3.5" />
          Records verified on-chain
        </span>
      </div>
      <AnimatePresence mode="wait">
        {!clicked ? (
          <motion.div key="actions" {...fade} className="flex gap-2 pt-1">
            <button className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-400">
              Reject
            </button>
            <button className="flex-1 rounded-lg bg-medical-green text-white px-2 py-1.5 text-xs font-medium">
              Approve
            </button>
          </motion.div>
        ) : (
          <motion.div key="done" {...fade} className="flex items-center justify-center gap-1.5 pt-1 text-medical-green">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">Claim Approved</span>
          </motion.div>
        )}
      </AnimatePresence>
      <ClickCursor active={clicked} className="bottom-9 right-3" />
    </div>
  );
}

export const DEMO_SCENES = [
  { key: "checkin", frame: "phone", url: null, title: "Hospital Check-In", caption: "Patient scans the front-desk QR and confirms — signed by their own wallet.", Scene: CheckInScene },
  { key: "request", frame: "browser", url: "doctor.healthchain.app", title: "Doctor Requests Access", caption: "Doctor looks the patient up by address and sends a request.", Scene: DoctorRequestScene },
  { key: "approve", frame: "phone", url: null, title: "Patient Approves", caption: "Request shows up on the patient's own dashboard, with a role badge and duration picker.", Scene: PatientApproveScene },
  { key: "dispense", frame: "browser", url: "pharmacy.healthchain.app", title: "Pharmacy Dispenses", caption: "Verified on-chain, then dispensed — re-dispensing the same script is blocked.", Scene: PharmacyDispenseScene },
  { key: "claim", frame: "browser", url: "insurer.healthchain.app", title: "Insurer Reviews a Claim", caption: "Only visible after the patient approved it, with records cross-checked live.", Scene: InsuranceClaimScene },
];
