"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, HeartPulse, ShieldCheck, Stethoscope, TestTube2, Wallet2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContractTx } from "@/hooks/useContractTx";
import { ROLE, roleSlug } from "@/lib/identityRegistry";

// This *is* the landing page's "Create Digital Health Identity" step —
// registration happens once per wallet and is what unlocks a role's dashboard.
const ROLE_OPTIONS = [
  { role: ROLE.Patient, label: "Patient", icon: HeartPulse, needsOrg: false },
  { role: ROLE.Doctor, label: "Doctor", icon: Stethoscope, needsOrg: false },
  { role: ROLE.Hospital, label: "Hospital", icon: Building2, needsOrg: true },
  { role: ROLE.Laboratory, label: "Laboratory", icon: TestTube2, needsOrg: true },
  { role: ROLE.Pharmacy, label: "Pharmacy", icon: Building2, needsOrg: true },
  { role: ROLE.Insurer, label: "Insurance Company", icon: ShieldCheck, needsOrg: true },
];

export default function RegisterForm({ onRegistered }) {
  const router = useRouter();
  const { account, connect, contracts, refreshRole } = useWallet();
  const { runTx } = useContractTx();

  const [selectedRole, setSelectedRole] = useState(null);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!account) {
    return (
      <button
        onClick={connect}
        className="inline-flex items-center gap-2 rounded-lg bg-brand text-white px-6 py-3 font-medium hover:bg-brand-light transition-colors"
      >
        <Wallet2 className="h-5 w-5" />
        Connect Wallet to Get Started
      </button>
    );
  }

  const selectedOption = ROLE_OPTIONS.find((o) => o.role === selectedRole);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedRole || !name.trim()) return;

    setSubmitting(true);
    try {
      await runTx(
        () => contracts.identity.register(selectedRole, name.trim(), organization.trim()),
        { pendingLabel: "Confirm registration in your wallet…", successLabel: "Identity created on-chain" }
      );
      await refreshRole();
      onRegistered?.();
      router.push(`/${roleSlug(selectedRole)}`);
    } catch {
      // useContractTx already surfaced the failure via a toast.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 w-full max-w-lg space-y-5">
      <div>
        <p className="font-medium mb-3">Choose your role</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ROLE_OPTIONS.map(({ role, label, icon: Icon }) => (
            <button
              type="button"
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors ${
                selectedRole === role
                  ? "border-brand bg-brand-pale text-brand"
                  : "border-gray-200 hover:border-brand/40"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="e.g. Sarah Mukamana"
          />
        </div>

        {selectedOption?.needsOrg && (
          <div>
            <label className="text-sm font-medium" htmlFor="organization">
              Organization name
            </label>
            <input
              id="organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="e.g. Kigali Central Hospital"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!selectedRole || !name.trim() || submitting}
        className="w-full rounded-lg bg-brand text-white px-4 py-2.5 font-medium hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Create My Digital Health Identity
      </button>
    </form>
  );
}
