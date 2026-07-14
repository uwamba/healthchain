"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert, Wallet } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { ROLE, roleLabel, roleSlug } from "@/lib/identityRegistry";
import EmptyState from "@/components/EmptyState";

// Wraps every role dashboard page. Gates on the *authoritative on-chain*
// role from IdentityRegistry.roleOf() — never a client preference — because
// every write on these pages reverts if the real role doesn't match.
export default function RoleGuard({ requiredRole, children }) {
  const router = useRouter();
  const { account, connect, role, roleLoading, setShowRegisterModal } = useWallet();

  if (!account) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <EmptyState
          icon={Wallet}
          title="Connect your wallet to continue"
          description={`This is the ${requiredRole} dashboard — connect the wallet you registered as a ${requiredRole} with.`}
          action={
            <button
              onClick={connect}
              className="mt-2 rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-light transition-colors"
            >
              Connect Wallet
            </button>
          }
        />
      </div>
    );
  }

  if (roleLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">Checking your on-chain role…</div>;
  }

  if (role === ROLE.None) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <EmptyState
          icon={ShieldAlert}
          title="This wallet isn't registered yet"
          description="Create your on-chain identity first, then come back to this dashboard."
          action={
            <button
              onClick={() => setShowRegisterModal(true)}
              className="mt-2 rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-light transition-colors"
            >
              Register Now
            </button>
          }
        />
      </div>
    );
  }

  if (roleLabel(role) !== requiredRole) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <EmptyState
          icon={ShieldAlert}
          title={`Wrong dashboard for a ${roleLabel(role)}`}
          description={`This wallet is registered as a ${roleLabel(role)} on-chain, not a ${requiredRole} — your role can't be changed here.`}
          action={
            <button
              onClick={() => router.push(`/${roleSlug(role)}`)}
              className="mt-2 rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-light transition-colors"
            >
              Go to your dashboard
            </button>
          }
        />
      </div>
    );
  }

  return children;
}
