"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CalendarClock, HeartPulse } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useWallet } from "@/context/WalletContext";
import { loadPatientRecords } from "@/lib/medicalRecordRegistry";
import {
  loadPendingRequestsForPatient,
  loadApprovedGrantsForPatient,
} from "@/lib/accessControlRegistry";
import { loadAllAppointments, appointmentStatusLabel } from "@/lib/appointmentRegistry";
import { loadVisitsForPatient } from "@/lib/visitRegistry";
import { loadReferralsForPatient } from "@/lib/referralRegistry";
import { loadClaimsForPatient, loadVisibilityRenewalRequestsForPatient } from "@/lib/claimRegistry";
import { loadPatientEventLog } from "@/lib/audit";
import MedicalAssetCard from "@/components/MedicalAssetCard";
import ActivityFeed from "@/components/ActivityFeed";
import AccessRequestPanel from "@/components/AccessRequestPanel";
import AccessGrantsList from "@/components/AccessGrantsList";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import BookAppointmentForm from "@/components/BookAppointmentForm";
import PendingCheckIns from "@/components/PendingCheckIns";
import LabReferralsPanel from "@/components/LabReferralsPanel";
import ClaimsAwaitingApproval from "@/components/ClaimsAwaitingApproval";
import ClaimVisibilityRenewalPanel from "@/components/ClaimVisibilityRenewalPanel";
import StatCard from "@/components/StatCard";
import { SkeletonGrid, SkeletonRow } from "@/components/Skeleton";

function PatientDashboard() {
  const { account, contracts } = useWallet();
  const [records, setRecords] = useState(null);
  const [issuerNames, setIssuerNames] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedGrants, setApprovedGrants] = useState([]);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [myAppointments, setMyAppointments] = useState([]);
  const [doctorNames, setDoctorNames] = useState({});
  const [visits, setVisits] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [claims, setClaims] = useState(null);
  const [renewalRequests, setRenewalRequests] = useState(null);
  const [directoryNames, setDirectoryNames] = useState({});
  const [eventLog, setEventLog] = useState(null);

  const load = useCallback(async () => {
    const [patientRecords, pending, approved, appointments, visitList, referralList, claimList] = await Promise.all([
      loadPatientRecords(contracts.records, account),
      loadPendingRequestsForPatient(contracts.access, contracts.identity, account),
      loadApprovedGrantsForPatient(contracts.access, contracts.identity, account),
      loadAllAppointments(contracts.appointment),
      loadVisitsForPatient(contracts.visit, account),
      loadReferralsForPatient(contracts.referral, account),
      loadClaimsForPatient(contracts.claim, account),
    ]);

    setRecords(patientRecords);
    setPendingRequests(pending);
    setApprovedGrants(approved);
    setVisits(visitList);
    setReferrals(referralList);
    setClaims(claimList);

    const renewals = await loadVisibilityRenewalRequestsForPatient(contracts.claim, claimList);
    setRenewalRequests(renewals);

    const directoryAddresses = [
      ...new Set([
        ...visitList.map((v) => v.hospital),
        ...referralList.map((r) => r.provider),
        ...referralList.map((r) => r.referringDoctor),
        ...claimList.map((c) => c.provider),
        ...claimList.map((c) => c.insurer),
      ]),
    ];
    const directoryProfiles = await Promise.all(directoryAddresses.map((addr) => contracts.identity.profiles(addr)));
    setDirectoryNames(
      Object.fromEntries(directoryAddresses.map((addr, i) => [addr, directoryProfiles[i].organization || directoryProfiles[i].name]))
    );

    const mine = appointments.filter((a) => a.patient.toLowerCase() === account.toLowerCase());
    setMyAppointments(mine);

    const now = Math.floor(Date.now() / 1000);
    const upcoming = mine
      .filter((a) => (a.status === 0 || a.status === 1) && a.scheduledFor > now)
      .sort((a, b) => a.scheduledFor - b.scheduledFor)[0];

    const uniqueDoctors = [...new Set(mine.map((a) => a.doctor))];
    const doctorProfiles = await Promise.all(uniqueDoctors.map((addr) => contracts.identity.profiles(addr)));
    const nameMap = Object.fromEntries(uniqueDoctors.map((addr, i) => [addr, doctorProfiles[i].name]));
    setDoctorNames(nameMap);

    setNextAppointment(upcoming ? { ...upcoming, doctorName: nameMap[upcoming.doctor] } : null);

    const uniqueIssuers = [...new Set(patientRecords.map((r) => r.issuer))];
    const names = await Promise.all(uniqueIssuers.map((addr) => contracts.identity.profiles(addr)));
    setIssuerNames(Object.fromEntries(uniqueIssuers.map((addr, i) => [addr, names[i].name])));

    const log = await loadPatientEventLog(contracts, account, {
      recordIds: patientRecords.map((r) => r.id),
      visitIds: visitList.map((v) => v.id),
      referralIds: referralList.map((r) => r.id),
      claimIds: claimList.map((c) => c.id),
      appointmentIds: mine.map((a) => a.id),
    });
    setEventLog(log);
  }, [account, contracts]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-gray-500 text-sm">Here's your health overview.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={HeartPulse} label="Health Score" value={92} suffix="%" accent="green" />
        <div className="glass rounded-2xl p-5 sm:col-span-2 flex items-center gap-4">
          <div className="rounded-full bg-brand-pale p-3">
            <CalendarClock className="h-5 w-5 text-brand" />
          </div>
          {nextAppointment ? (
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">Next Appointment</p>
                <span
                  className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                    nextAppointment.status === 1 ? "bg-medical-green-pale text-medical-green" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {appointmentStatusLabel(nextAppointment.status)}
                </span>
              </div>
              <p className="font-medium">{nextAppointment.doctorName || "Doctor"}</p>
              <p className="text-sm text-gray-500">
                {new Date(nextAppointment.scheduledFor * 1000).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming appointments</p>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Medical Assets</h2>
        {records === null ? (
          <SkeletonGrid />
        ) : records.length === 0 ? (
          <div className="glass rounded-2xl">
            <p className="text-center text-sm text-gray-500 py-8">
              No medical records yet — they'll appear here once a doctor, hospital, lab, or pharmacy issues one.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((record, i) => (
              <MedicalAssetCard key={record.id} record={record} issuerName={issuerNames[record.issuer]} index={i} />
            ))}
          </div>
        )}
      </section>

      <div className="grid sm:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Access Requests</h2>
          <AccessRequestPanel pendingRequests={pendingRequests} onResolved={load} />
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-4">Who Has Access</h2>
          <AccessGrantsList grants={approvedGrants} onResolved={load} />
        </section>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Appointments</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <AppointmentCalendar
            appointments={myAppointments.filter((a) => a.status === 0 || a.status === 1)}
            renderDay={(dayAppointments) =>
              dayAppointments.length === 0 ? (
                <p className="text-xs text-gray-400">No appointments this day.</p>
              ) : (
                dayAppointments.map((a) => (
                  <div key={a.id} className="text-xs">
                    <p className="font-medium">{doctorNames[a.doctor] || "Doctor"}</p>
                    <p className="text-gray-500">
                      {new Date(a.scheduledFor * 1000).toLocaleTimeString()} — {a.reason} (
                      {appointmentStatusLabel(a.status)})
                    </p>
                  </div>
                ))
              )
            }
          />
          <BookAppointmentForm onBooked={load} />
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Pending Check-Ins</h2>
          {visits === null ? (
            <SkeletonRow />
          ) : (
            <PendingCheckIns
              visits={visits.filter((v) => v.status === 0)}
              hospitalNames={directoryNames}
              onResolved={load}
            />
          )}
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-4">Claims Awaiting Your Approval</h2>
          {claims === null ? (
            <SkeletonRow />
          ) : (
            <ClaimsAwaitingApproval
              claims={claims.filter((c) => c.status === 0)}
              providerNames={directoryNames}
              insurerNames={directoryNames}
              onResolved={load}
            />
          )}
        </section>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Claim Visibility Renewals</h2>
        {renewalRequests === null ? (
          <SkeletonRow />
        ) : (
          <ClaimVisibilityRenewalPanel claims={renewalRequests} directoryNames={directoryNames} onResolved={load} />
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Lab Referrals</h2>
        {referrals === null ? (
          <SkeletonRow />
        ) : (
          <LabReferralsPanel
            referrals={referrals}
            doctorNames={{ ...doctorNames, ...directoryNames }}
            labNames={directoryNames}
            onResolved={load}
          />
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand" />
          Activity Log
        </h2>
        <ActivityFeed
          events={eventLog}
          emptyDescription="Every on-chain action involving you — registrations, appointments, access grants, visits, referrals, and claims — will be listed here."
        />
      </section>
    </div>
  );
}

export default function PatientPage() {
  return (
    <RoleGuard requiredRole="Patient">
      <PatientDashboard />
    </RoleGuard>
  );
}
