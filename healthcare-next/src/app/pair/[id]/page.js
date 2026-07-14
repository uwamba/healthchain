"use client";

import { use, useState } from "react";
import { CheckCircle2, HeartPulse, Send, Wallet2 } from "lucide-react";

// Scanned from a desktop's "Request via Phone" QR (see AddressInput.js) —
// deliberately does NOT use WalletContext.connect(), which resolves the
// on-chain role and redirects to a dashboard; this page only needs the raw
// address, handed back to the waiting desktop via /api/pair, nothing more.
export default function PairPage({ params }) {
  const { id } = use(params);
  const [address, setAddress] = useState(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    if (typeof window.ethereum === "undefined") {
      setError("No wallet extension detected — open this page in a browser with MetaMask installed.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0]);
    } catch (err) {
      setError(err?.message || "Failed to connect wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/pair", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, address }),
      });
      if (!response.ok) throw new Error("This request has expired — ask the front desk to try again.");
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
        <HeartPulse className="h-8 w-8 text-brand mx-auto" />

        {sent ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-medical-green mx-auto" />
            <p className="font-medium">Sent!</p>
            <p className="text-sm text-gray-500">You can put your phone away now.</p>
          </>
        ) : address ? (
          <>
            <p className="font-medium">Confirm your address</p>
            <p className="font-mono text-xs text-gray-500 break-all">{address}</p>
            <button
              onClick={send}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-white px-4 py-2.5 font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send to Front Desk
            </button>
          </>
        ) : (
          <>
            <p className="font-medium">Share your wallet address</p>
            <p className="text-sm text-gray-500">Connect your wallet to send your address to the front desk.</p>
            <button
              onClick={connect}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-white px-4 py-2.5 font-medium hover:bg-brand-light transition-colors disabled:opacity-50"
            >
              <Wallet2 className="h-4 w-4" />
              Connect Wallet
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
