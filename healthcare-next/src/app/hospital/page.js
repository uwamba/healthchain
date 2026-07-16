"use client";

import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  Activity,
  BarChart3,
  Building2,
  FileHeart,
  FileStack,
  LayoutDashboard,
  Stethoscope,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import RoleGuard from "@/components/RoleGuard";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { loadPendingAffiliationRequests, loadConfirmedDoctorsForHospital } from "@/lib/identityRegistry";
import { loadAuditTrail, summarizeAuditTrail, bucketByDay } from "@/lib/audit";
import { loadVisitsForHospital } from "@/lib/visitRegistry";
import { loadRecordsByIssuer, RECORD_TYPES } from "@/lib/medicalRecordRegistry";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import CheckInPanel from "@/components/CheckInPanel";
import ActivityFeed from "@/components/ActivityFeed";
import CreateRecordForm from "@/components/CreateRecordForm";
import BatchClaimPanel from "@/components/BatchClaimPanel";
import { SkeletonCard, SkeletonRow } from "@/components/Skeleton";

const HOSPITAL_RECORD_TYPES = [0, 1, 3, 4, 5]; // Consultation, LabResult, Imaging, Discharge, Vaccination (not Prescription)

// Colors validated for categorical CVD-safety with
// scripts/validate_palette.js "#0B5FFF,#00C896,#8B5CF6" — worst adjacent
// pair ΔE 82.8, well clear of the >=12 target (see docs/ARCHITECTURE.md).
const BRAND_BLUE = "#0B5FFF";
const MEDICAL_GREEN = "#00C896";
const BLOCKCHAIN_PURPLE = "#8B5CF6";
const GRIDLINE = "#e1e0d9";
const AXIS_TEXT = "#898781";

const MENU_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "checkin", label: "Check-In", icon: UserPlus },
  { key: "affiliations", label: "Doctor Affiliations", icon: UserCheck },
  { key: "billing", label: "Billing & Claims", icon: FileStack },
  { key: "activity", label: "Activity Log", icon: Activity },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

function HospitalDashboard() {
  const { account, contracts } = useWallet();
  const { runTx } = useContractTx();
  const [activeTab, setActiveTab] = useState("overview");

  const [hospitalProfile, setHospitalProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [recentEvents, setRecentEvents] = useState(null);
  const [pendingDoctors, setPendingDoctors] = useState(null);
  const [confirmingDoctor, setConfirmingDoctor] = useState(null);
  const [affiliatedDoctors, setAffiliatedDoctors] = useState(null);

  const [patientGrowth, setPatientGrowth] = useState(null);
  const [recordCreation, setRecordCreation] = useState(null);
  const [accessActivity, setAccessActivity] = useState(null);

  const [visits, setVisits] = useState(null);
  const [visitPatientNames, setVisitPatientNames] = useState({});

  const [billingPatientAddress, setBillingPatientAddress] = useState("");
  const [unclaimedRecords, setUnclaimedRecords] = useState(null);
  const [issuedPatientNames, setIssuedPatientNames] = useState({});

  const load = useCallback(async () => {
    const [profile, events, pending, confirmed] = await Promise.all([
      contracts.identity.profiles(account),
      loadAuditTrail(contracts),
      loadPendingAffiliationRequests(contracts.identity, account),
      loadConfirmedDoctorsForHospital(contracts.identity, account),
    ]);

    setHospitalProfile(profile);
    setSummary(summarizeAuditTrail(events));
    setRecentEvents(events.slice(0, 8));
    setPendingDoctors(pending);
    setAffiliatedDoctors(confirmed);

    setPatientGrowth(bucketByDay(events, ["Registered"]));
    setRecordCreation(bucketByDay(events, ["RecordCreated"]));

    const requested = bucketByDay(events, ["AccessRequested"]);
    const approved = bucketByDay(events, ["AccessApproved"]);
    const days = [...new Set([...requested, ...approved].map((d) => d.date))].sort();
    setAccessActivity(
      days.map((date) => ({
        date,
        requested: requested.find((d) => d.date === date)?.count ?? 0,
        approved: approved.find((d) => d.date === date)?.count ?? 0,
      }))
    );
  }, [contracts, account]);

  const loadVisits = useCallback(async () => {
    const all = await loadVisitsForHospital(contracts.visit, account);
    setVisits(all);

    const uniquePatients = [...new Set(all.map((v) => v.patient))];
    const profiles = await Promise.all(uniquePatients.map((addr) => contracts.identity.profiles(addr)));
    setVisitPatientNames(Object.fromEntries(uniquePatients.map((addr, i) => [addr, profiles[i].name])));
  }, [contracts, account]);

  const loadIssuedRecords = useCallback(async () => {
    const records = await loadRecordsByIssuer(contracts.records, account);

    const claimedFlags = await Promise.all(records.map((r) => contracts.claim.recordClaimed(r.id)));
    const unclaimed = records.filter((_, i) => !claimedFlags[i]);
    setUnclaimedRecords(unclaimed);

    const uniquePatients = [...new Set(unclaimed.map((r) => r.patient))];
    const profiles = await Promise.all(uniquePatients.map((addr) => contracts.identity.profiles(addr)));
    setIssuedPatientNames(Object.fromEntries(uniquePatients.map((addr, i) => [addr, profiles[i].name])));
  }, [contracts, account]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    loadIssuedRecords();
  }, [loadIssuedRecords]);

  async function confirmAffiliation(doctor) {
    setConfirmingDoctor(doctor);
    try {
      await runTx(() => contracts.identity.confirmHospitalAffiliation(doctor), {
        pendingLabel: "Confirming affiliation…",
        successLabel: "Doctor affiliated",
      });
      load();
    } catch {
      // toast already shows the failure
    } finally {
      setConfirmingDoctor(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-11 w-11 rounded-full bg-brand-pale text-brand flex items-center justify-center shrink-0">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{hospitalProfile?.organization || "Hospital Dashboard"}</h1>
          <p className="text-gray-500 text-sm">
            {hospitalProfile?.name ? `Managed by ${hospitalProfile.name}` : "Enterprise-wide activity across the whole network."}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        <aside className="min-w-0">
          <nav className="glass rounded-2xl p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {MENU_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-left whitespace-nowrap transition-colors ${
                  activeTab === key ? "bg-brand text-white" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          {activeTab === "overview" && (
            <div className="space-y-8">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Registered Patients" value={summary?.registrations ?? 0} accent="brand" />
                <StatCard icon={Stethoscope} label="Appointments Booked" value={summary?.appointmentsBooked ?? 0} accent="green" />
                <StatCard icon={FileHeart} label="Records Created" value={summary?.recordsCreated ?? 0} accent="purple" />
                <StatCard icon={Activity} label="Blockchain Transactions" value={summary?.totalTransactions ?? 0} accent="brand" />
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4">Currently Checked-In</h2>
                {visits === null ? (
                  <SkeletonRow />
                ) : visits.filter((v) => v.status === 1).length === 0 ? (
                  <EmptyState
                    title="No patients checked in right now"
                    description="Check a patient in from the Check-In tab — they'll show up here once they approve."
                  />
                ) : (
                  <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
                    {visits
                      .filter((v) => v.status === 1)
                      .map((v) => (
                        <div key={v.id} className="p-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{visitPatientNames[v.patient] || "Patient"}</p>
                          <span className={`text-xs ${v.assignedDoctor !== ethers.constants.AddressZero ? "text-medical-green" : "text-gray-400"}`}>
                            {v.assignedDoctor !== ethers.constants.AddressZero ? "Doctor assigned" : "Awaiting doctor"}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4">Recent Blockchain Activity</h2>
                <ActivityFeed events={recentEvents} />
              </div>
            </div>
          )}

          {activeTab === "checkin" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Patient Check-In</h2>
              {visits === null || affiliatedDoctors === null ? (
                <SkeletonRow />
              ) : (
                <CheckInPanel
                  requestedVisits={visits.filter((v) => v.status === 0)}
                  checkedInVisits={visits.filter((v) => v.status === 1)}
                  patientNames={visitPatientNames}
                  affiliatedDoctors={affiliatedDoctors}
                  onChanged={loadVisits}
                />
              )}
            </div>
          )}

          {activeTab === "affiliations" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Doctor Affiliation Requests</h2>
              {pendingDoctors === null ? (
                <SkeletonRow />
              ) : pendingDoctors.length === 0 ? (
                <EmptyState title="No pending requests" description="Doctors who request affiliation with this hospital will appear here." />
              ) : (
                <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
                  {pendingDoctors.map((d) => (
                    <div key={d.doctor} className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{d.doctorName || "Unnamed Doctor"}</p>
                        <p className="text-xs text-gray-500 font-mono">
                          {d.doctor.slice(0, 6)}…{d.doctor.slice(-4)}
                        </p>
                        {d.doctorLicense && (
                          <p className="text-xs text-gray-500">License #{d.doctorLicense}</p>
                        )}
                        {d.doctorPhone && <p className="text-xs text-gray-500">{d.doctorPhone}</p>}
                      </div>
                      <button
                        onClick={() => confirmAffiliation(d.doctor)}
                        disabled={confirmingDoctor === d.doctor}
                        className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:bg-brand-light disabled:opacity-50"
                      >
                        Confirm
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <h2 className="text-lg font-semibold mb-4 mt-8">Affiliated Doctors</h2>
              {affiliatedDoctors === null ? (
                <SkeletonRow />
              ) : affiliatedDoctors.length === 0 ? (
                <EmptyState title="No affiliated doctors yet" description="Doctors you confirm above will appear here as your roster." />
              ) : (
                <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
                  {affiliatedDoctors.map((d) => (
                    <div key={d.doctor} className="p-3">
                      <p className="font-medium text-sm">{d.doctorName || "Unnamed Doctor"}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {d.doctor.slice(0, 6)}…{d.doctor.slice(-4)}
                      </p>
                      {d.doctorLicense && <p className="text-xs text-gray-500">License #{d.doctorLicense}</p>}
                      {d.doctorPhone && <p className="text-xs text-gray-500">{d.doctorPhone}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "billing" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold mb-2">Log Service / Bill</h2>
                <p className="text-xs text-gray-400 mb-3">
                  Record a consultation, lab result, or other service rendered for a checked-in patient — Available
                  types: {HOSPITAL_RECORD_TYPES.map((t) => RECORD_TYPES[t]).join(", ")}.
                </p>
                {visits === null ? (
                  <SkeletonRow />
                ) : (
                  <div className="space-y-3">
                    <select
                      value={billingPatientAddress}
                      onChange={(e) => setBillingPatientAddress(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="">Select a checked-in patient…</option>
                      {[...new Set(visits.filter((v) => v.status === 1).map((v) => v.patient))].map((addr) => (
                        <option key={addr} value={addr}>
                          {visitPatientNames[addr] || addr}
                        </option>
                      ))}
                    </select>
                    <CreateRecordForm
                      patientAddress={billingPatientAddress || null}
                      allowedTypes={HOSPITAL_RECORD_TYPES}
                      onCreated={loadIssuedRecords}
                    />
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-2">File Insurance Claims</h2>
                <p className="text-xs text-gray-400 mb-4">
                  Services you&rsquo;ve logged that haven&rsquo;t been billed yet, grouped by patient — select some
                  and file one claim per patient whenever you choose to reconcile.
                </p>
                {unclaimedRecords === null ? (
                  <SkeletonRow />
                ) : (
                  <BatchClaimPanel
                    records={unclaimedRecords}
                    patientNames={issuedPatientNames}
                    onSubmitted={loadIssuedRecords}
                    emptyDescription="Services you log above that haven't been billed yet will appear here, grouped by patient."
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === "activity" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Activity Log</h2>
              <ActivityFeed events={recentEvents} />
            </div>
          )}

          {activeTab === "analytics" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Analytics</h2>
              <div className="grid lg:grid-cols-2 gap-6">
                <ChartCard title="Registrations Over Time" data={patientGrowth}>
                  {(data) => (
                    <LineChart data={data}>
                      <CartesianGrid stroke={GRIDLINE} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={{ stroke: GRIDLINE }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" name="Registrations" stroke={BRAND_BLUE} strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  )}
                </ChartCard>

                <ChartCard title="Medical Records Created" data={recordCreation}>
                  {(data) => (
                    <BarChart data={data}>
                      <CartesianGrid stroke={GRIDLINE} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={{ stroke: GRIDLINE }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Records Created" fill={MEDICAL_GREEN} radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  )}
                </ChartCard>

                <ChartCard title="Access Requests vs. Approvals" data={accessActivity} span>
                  {(data) => (
                    <BarChart data={data}>
                      <CartesianGrid stroke={GRIDLINE} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={{ stroke: GRIDLINE }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="requested" name="Requested" fill={BRAND_BLUE} radius={[4, 4, 0, 0]} maxBarSize={20} />
                      <Bar dataKey="approved" name="Approved" fill={BLOCKCHAIN_PURPLE} radius={[4, 4, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  )}
                </ChartCard>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ChartCard({ title, data, children, span = false }) {
  return (
    <div className={`glass rounded-2xl p-5 ${span ? "lg:col-span-2" : ""}`}>
      <h3 className="font-semibold mb-4">{title}</h3>
      {data === null ? (
        <SkeletonCard />
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No activity yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          {children(data)}
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function HospitalPage() {
  return (
    <RoleGuard requiredRole="Hospital">
      <HospitalDashboard />
    </RoleGuard>
  );
}
