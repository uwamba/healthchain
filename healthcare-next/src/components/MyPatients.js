"use client";

import { Users } from "lucide-react";
import EmptyState from "@/components/EmptyState";

// Every patient who currently has an unexpired access grant approved for
// this doctor (see loadApprovedPatientsForDoctor) — clicking one loads them
// straight into Medical History below, without re-typing their address into
// Patient Search.
export default function MyPatients({ patients, onSelect }) {
  if (patients.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No patients yet"
        description="Once a patient approves your access request, they'll show up here for one-click access — no need to search them again."
      />
    );
  }

  return (
    <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
      {patients.map((patient) => (
        <button
          key={patient.address}
          onClick={() => onSelect({ address: patient.address, name: patient.name, hasAccess: true })}
          className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <p className="font-medium text-sm">{patient.name || "Unnamed Patient"}</p>
          <p className="text-xs text-gray-500 font-mono">
            {patient.address.slice(0, 6)}…{patient.address.slice(-4)}
          </p>
          <p className="text-xs text-gray-400">Access expires {new Date(patient.expiresAt * 1000).toLocaleString()}</p>
        </button>
      ))}
    </div>
  );
}
