"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { ROLE } from "@/lib/identityRegistry";
import AddressInput from "@/components/AddressInput";

export default function BookAppointmentForm({ onBooked }) {
  const { contracts } = useWallet();
  const { runTx } = useContractTx();
  const [doctorAddress, setDoctorAddress] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const trimmed = doctorAddress.trim();
    if (!ethers.utils.isAddress(trimmed)) {
      setError("Enter a valid doctor wallet address.");
      return;
    }
    const scheduledFor = Math.floor(new Date(dateTime).getTime() / 1000);
    if (!scheduledFor || scheduledFor <= Math.floor(Date.now() / 1000)) {
      setError("Pick a future date and time.");
      return;
    }

    setSubmitting(true);
    try {
      const role = await contracts.identity.roleOf(trimmed);
      if (role !== ROLE.Doctor) {
        setError("That address isn't registered as a doctor.");
        setSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("Doctor lookup failed:", err);
      setError(
        err?.reason ||
          "Lookup failed — check that your wallet is connected to the same network the contracts are deployed on."
      );
      setSubmitting(false);
      return;
    }

    try {
      await runTx(() => contracts.appointment.bookAppointment(trimmed, scheduledFor, reason), {
        pendingLabel: "Requesting appointment…",
        successLabel: "Appointment requested — waiting for the doctor to confirm",
      });
      setDoctorAddress("");
      setDateTime("");
      setReason("");
      onBooked?.();
    } catch (err) {
      setError(err?.reason || "Booking failed — that slot may already be taken.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 space-y-3">
      <p className="font-medium flex items-center gap-2">
        <CalendarPlus className="h-4 w-4 text-brand" />
        Book Appointment
      </p>
      <AddressInput value={doctorAddress} onChange={setDoctorAddress} placeholder="Doctor wallet address (0x…)" />
      <input
        type="datetime-local"
        value={dateTime}
        onChange={(e) => setDateTime(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        required
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for visit"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-white px-4 py-2.5 font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Book Appointment
      </button>
    </form>
  );
}
