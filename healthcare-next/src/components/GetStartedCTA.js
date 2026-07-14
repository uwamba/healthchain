"use client";

import { Wallet2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

// The inline landing-page counterpart to RegisterModal: connecting from here
// triggers the exact same WalletContext.connect() flow (resolve role ->
// redirect if registered, pop the registration modal if not), so this button
// never needs its own copy of the role-picker form.
export default function GetStartedCTA() {
  const { account, connect, setShowRegisterModal } = useWallet();

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

  // Connected but still unregistered — reachable if the popup was dismissed
  // before finishing registration.
  return (
    <button
      onClick={() => setShowRegisterModal(true)}
      className="inline-flex items-center gap-2 rounded-lg bg-brand text-white px-6 py-3 font-medium hover:bg-brand-light transition-colors"
    >
      Complete Registration
    </button>
  );
}
