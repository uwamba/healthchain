"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { ROLE } from "@/lib/identityRegistry";
import EmptyState from "@/components/EmptyState";
import AddressInput from "@/components/AddressInput";

// Front-desk check-in: the hospital opens a visit for a patient who has
// walked in. The QR shown encodes a deep link to the patient's own
// dashboard for this exact visit — the patient scans it with their own
// phone's camera and approves there, which is the real signed transaction
// (see VisitRegistry.sol / docs/ARCHITECTURE.md's QR note). Requested visits
// awaiting approval and checked-in visits (with an "Assign Doctor" action)
// are both listed below. Assignment is a dropdown of this hospital's own
// confirmed-affiliated doctors (see loadConfirmedDoctorsForHospital) rather
// than a free-text address — a hospital dispatches to its own staff, not an
// arbitrary registered doctor.
export default function CheckInPanel({ requestedVisits, checkedInVisits, patientNames, affiliatedDoctors, onChanged }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();

  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [newVisit, setNewVisit] = useState(null); // { id, patientAddress }

  const [doctorInputByVisit, setDoctorInputByVisit] = useState({});
  const [assigningVisit, setAssigningVisit] = useState(null);
  const [assignError, setAssignError] = useState(null);

  async function handleCheckIn(e) {
    e.preventDefault();
    setError(null);
    setNewVisit(null);

    const trimmed = input.trim();
    if (!ethers.utils.isAddress(trimmed)) {
      setError("Enter a valid patient wallet address.");
      return;
    }

    setSubmitting(true);
    try {
      const role = await contracts.identity.roleOf(trimmed);
      if (role !== ROLE.Patient) {
        setError("This address isn't registered as a patient.");
        setSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("Patient lookup failed:", err);
      setError(
        err?.reason ||
          "Lookup failed — check that your wallet is connected to the same network the contracts are deployed on."
      );
      setSubmitting(false);
      return;
    }

    try {
      const receipt = await runTx(() => contracts.visit.requestVisit(trimmed), {
        pendingLabel: "Opening check-in…",
        successLabel: "Check-in request created — show the QR to the patient",
      });
      const event = receipt.events?.find((e) => e.event === "VisitRequested");
      const visitId = event?.args?.id?.toNumber();
      setNewVisit({ id: visitId, patientAddress: trimmed });
      setInput("");
      onChanged?.();
    } catch {
      // toast already shows the failure
    } finally {
      setSubmitting(false);
    }
  }

  async function assignDoctor(visitId) {
    setAssignError(null);
    const doctorAddress = (doctorInputByVisit[visitId] || "").trim();
    if (!ethers.utils.isAddress(doctorAddress)) {
      setAssignError("Select a doctor to assign.");
      return;
    }

    setAssigningVisit(visitId);
    try {
      await runTx(() => contracts.visit.assignDoctor(visitId, doctorAddress), {
        pendingLabel: "Assigning doctor…",
        successLabel: "Doctor assigned",
      });
      onChanged?.();
    } catch {
      // toast already shows the failure
    } finally {
      setAssigningVisit(null);
    }
  }

  const checkInUrl = (visitId) =>
    typeof window !== "undefined" ? `${window.location.origin}/patient?visit=${visitId}` : "";

  return (
    <div className="space-y-8">
      <div className="glass rounded-2xl p-5 space-y-4">
        <p className="font-medium flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand" />
          Check In a Patient
        </p>
        <form onSubmit={handleCheckIn} className="flex gap-2">
          <AddressInput value={input} onChange={setInput} placeholder="Patient wallet address (0x…)" />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand text-white px-3 py-2 hover:bg-brand-light transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>
        {submitting && <p className="text-xs text-gray-400">Working on it…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {newVisit && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-500">Have the patient scan this to confirm check-in:</p>
            <QRCodeSVG value={checkInUrl(newVisit.id)} size={160} />
            <p className="font-mono text-xs text-gray-400">Visit #{newVisit.id}</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-medium mb-3">Awaiting Patient Approval</h3>
        {requestedVisits.length === 0 ? (
          <EmptyState title="No pending check-ins" description="Visits you open will wait here until the patient approves." />
        ) : (
          <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
            {requestedVisits.map((visit) => (
              <div key={visit.id} className="p-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{patientNames[visit.patient] || "Patient"}</p>
                <QRCodeSVG value={checkInUrl(visit.id)} size={40} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-medium mb-3">Checked-In — Assign a Doctor</h3>
        {checkedInVisits.length === 0 ? (
          <EmptyState title="No checked-in patients yet" description="Once a patient approves check-in, assign them to a doctor here." />
        ) : affiliatedDoctors.length === 0 ? (
          <EmptyState
            title="No affiliated doctors yet"
            description="A doctor must request affiliation (and you confirm it under Doctor Affiliations) before you can assign them to a checked-in patient."
          />
        ) : (
          <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
            {checkedInVisits.map((visit) => (
              <div key={visit.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{patientNames[visit.patient] || "Patient"}</p>
                  {visit.assignedDoctor !== ethers.constants.AddressZero && (
                    <span className="text-xs text-medical-green">Assigned</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    value={doctorInputByVisit[visit.id] || ""}
                    onChange={(e) => setDoctorInputByVisit((prev) => ({ ...prev, [visit.id]: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Select a doctor…</option>
                    {affiliatedDoctors.map((d) => (
                      <option key={d.doctor} value={d.doctor}>
                        {d.doctorName || "Unnamed Doctor"}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignDoctor(visit.id)}
                    disabled={assigningVisit === visit.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-light disabled:opacity-50 shrink-0"
                  >
                    {assigningVisit === visit.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {assignError && <p className="text-sm text-red-500 mt-2">{assignError}</p>}
      </div>
    </div>
  );
}
