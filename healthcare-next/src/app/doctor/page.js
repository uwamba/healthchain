"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { loadAllAppointments } from "@/lib/appointmentRegistry";
import { loadPatientRecords, RECORD_TYPES } from "@/lib/medicalRecordRegistry";
import { loadVisitsAssignedToDoctor } from "@/lib/visitRegistry";
import { loadApprovedPatientsForDoctor } from "@/lib/accessControlRegistry";
import PatientLookup from "@/components/PatientLookup";
import MyPatients from "@/components/MyPatients";
import RecordTimeline from "@/components/RecordTimeline";
import CreateRecordForm from "@/components/CreateRecordForm";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import RequestAffiliationForm from "@/components/RequestAffiliationForm";
import CheckedInPatients from "@/components/CheckedInPatients";
import ReferToLabForm from "@/components/ReferToLabForm";
import EmptyState from "@/components/EmptyState";
import { SkeletonRow } from "@/components/Skeleton";

const DOCTOR_RECORD_TYPES = [0, 2]; // Consultation, Prescription

function DoctorDashboard() {
  const { account, contracts } = useWallet();
  const { runTx } = useContractTx();
  const [appointments, setAppointments] = useState(null);
  const [allMyAppointments, setAllMyAppointments] = useState([]);
  const [patientNames, setPatientNames] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientRecords, setPatientRecords] = useState(null);
  const [checkedInVisits, setCheckedInVisits] = useState(null);
  const [myPatients, setMyPatients] = useState(null);

  const loadMyPatients = useCallback(async () => {
    const patients = await loadApprovedPatientsForDoctor(contracts.access, contracts.identity, account);
    setMyPatients(patients);
  }, [account, contracts]);

  const loadCheckedInVisits = useCallback(async () => {
    const assigned = await loadVisitsAssignedToDoctor(contracts.visit, account);
    const checkedIn = assigned.filter((v) => v.status === 1); // CheckedIn
    setCheckedInVisits(checkedIn);

    const uniquePatients = [...new Set(checkedIn.map((v) => v.patient))];
    const profiles = await Promise.all(uniquePatients.map((addr) => contracts.identity.profiles(addr)));
    setPatientNames((prev) => ({
      ...prev,
      ...Object.fromEntries(uniquePatients.map((addr, i) => [addr, profiles[i].name])),
    }));
  }, [account, contracts]);

  const loadAppointments = useCallback(async () => {
    const all = await loadAllAppointments(contracts.appointment);
    const mine = all.filter((a) => a.doctor.toLowerCase() === account.toLowerCase());
    setAllMyAppointments(mine);

    const uniquePatients = [...new Set(mine.map((a) => a.patient))];
    const profiles = await Promise.all(uniquePatients.map((addr) => contracts.identity.profiles(addr)));
    const nameMap = Object.fromEntries(uniquePatients.map((addr, i) => [addr, profiles[i].name]));
    setPatientNames(nameMap);

    const now = Math.floor(Date.now() / 1000);
    const upcoming = mine
      .filter((a) => a.status === 0 && a.scheduledFor >= now)
      .sort((a, b) => a.scheduledFor - b.scheduledFor)
      .map((a) => ({ ...a, patientName: nameMap[a.patient] }));
    setAppointments(upcoming);
  }, [account, contracts]);

  async function cancelAppointment(id) {
    try {
      await runTx(() => contracts.appointment.cancelAppointment(id), {
        pendingLabel: "Cancelling appointment…",
        successLabel: "Appointment cancelled",
      });
      loadAppointments();
    } catch {
      // toast already shows the failure
    }
  }

  const loadRecords = useCallback(async () => {
    if (!selectedPatient?.hasAccess) {
      setPatientRecords(null);
      return;
    }
    const records = await loadPatientRecords(contracts.records, selectedPatient.address);
    setPatientRecords(records);
  }, [contracts, selectedPatient]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    loadCheckedInVisits();
  }, [loadCheckedInVisits]);

  useEffect(() => {
    loadMyPatients();
  }, [loadMyPatients]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid lg:grid-cols-[320px_1fr] gap-8">
      <aside className="space-y-6 min-w-0">
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-brand" />
            Upcoming Appointments
          </h2>
          {appointments === null ? (
            <div className="glass rounded-2xl p-4">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState title="No upcoming appointments" description="Booked appointments will appear here." />
          ) : (
            <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
              {appointments.map((a) => (
                <div key={a.id} className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{a.patientName || "Patient"}</p>
                    <p className="text-xs text-gray-500">{new Date(a.scheduledFor * 1000).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{a.reason}</p>
                  </div>
                  <button
                    onClick={() => cancelAppointment(a.id)}
                    className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Checked-In Patients</h2>
          {checkedInVisits === null ? (
            <SkeletonRow />
          ) : (
            <CheckedInPatients
              visits={checkedInVisits}
              patientNames={patientNames}
              onAccessRequested={loadCheckedInVisits}
            />
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">My Patients</h2>
          {myPatients === null ? (
            <SkeletonRow />
          ) : (
            <MyPatients patients={myPatients} onSelect={setSelectedPatient} />
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Patient Search</h2>
          <p className="text-xs text-gray-400 mb-2">Look up a new patient by address to request access.</p>
          <PatientLookup onPatientResolved={setSelectedPatient} />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Hospital Affiliation</h2>
          <RequestAffiliationForm />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Calendar</h2>
          <AppointmentCalendar
            appointments={allMyAppointments}
            renderDay={(dayAppointments) =>
              dayAppointments.length === 0 ? (
                <p className="text-xs text-gray-400">No appointments this day.</p>
              ) : (
                dayAppointments.map((a) => (
                  <div key={a.id} className="text-xs">
                    <p className="font-medium">{patientNames[a.patient] || "Patient"}</p>
                    <p className="text-gray-500">{new Date(a.scheduledFor * 1000).toLocaleTimeString()} — {a.reason}</p>
                  </div>
                ))
              )
            }
          />
        </div>
      </aside>

      <section className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Medical History</h2>
          {!selectedPatient ? (
            <EmptyState title="Search a patient" description="Look up a patient by wallet address to view their records or request access." />
          ) : !selectedPatient.hasAccess ? (
            <EmptyState
              title="Access not yet granted"
              description="Send a request from the patient search panel — the patient must approve it before you can view their records."
            />
          ) : patientRecords === null ? (
            <SkeletonRow />
          ) : (
            <RecordTimeline records={patientRecords} />
          )}
        </div>

        {selectedPatient?.hasAccess && (
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h2 className="text-lg font-semibold mb-4">Create Prescription / Consultation Note</h2>
              <p className="text-xs text-gray-400 mb-3">
                Available types: {DOCTOR_RECORD_TYPES.map((t) => RECORD_TYPES[t]).join(", ")}
              </p>
              <CreateRecordForm patientAddress={selectedPatient.address} allowedTypes={DOCTOR_RECORD_TYPES} onCreated={loadRecords} />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-4">Refer to Lab</h2>
              <ReferToLabForm patientAddress={selectedPatient.address} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function DoctorPage() {
  return (
    <RoleGuard requiredRole="Doctor">
      <DoctorDashboard />
    </RoleGuard>
  );
}
