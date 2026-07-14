"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, QrCode, Smartphone, X } from "lucide-react";
import QRScanner from "@/components/QRScanner";

const POLL_INTERVAL_MS = 2000;

// Drop-in replacement for a plain address <input>, with two ways to avoid
// typing a 42-character hex string:
//   - "Scan" — for when the person filling the form has a camera (opens it
//     directly and reads someone else's MyAddressQR).
//   - "Request via Phone" — for the common case of a front-desk laptop with
//     no camera: this shows a QR the OTHER person scans with their own
//     phone, connects their wallet there, and taps Send — their address is
//     relayed back here via /api/pair and fills the field automatically.
export default function AddressInput({ value, onChange, placeholder, className = "" }) {
  const [scanning, setScanning] = useState(false);
  const [pairing, setPairing] = useState(null); // { id }
  const pollRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  function handleScan(decodedText) {
    onChange(extractAddress(decodedText));
    setScanning(false);
  }

  async function startPairing() {
    const response = await fetch("/api/pair", { method: "POST" });
    const { id } = await response.json();
    setPairing({ id });

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/pair?id=${id}`);
      if (!res.ok) return; // expired — user can just close and retry
      const { address } = await res.json();
      if (address) {
        onChange(address);
        clearInterval(pollRef.current);
        setPairing(null);
      }
    }, POLL_INTERVAL_MS);
  }

  function closePairing() {
    clearInterval(pollRef.current);
    setPairing(null);
  }

  const pairingUrl = (id) => (typeof window !== "undefined" ? `${window.location.origin}/pair/${id}` : "");

  return (
    <div className="flex-1 flex gap-2 min-w-0">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand ${className}`}
      />
      <button
        type="button"
        onClick={() => setScanning(true)}
        className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors shrink-0"
        aria-label="Scan wallet address with this device's camera"
        title="Scan with this device's camera"
      >
        <QrCode className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={startPairing}
        className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors shrink-0"
        aria-label="Request address from a phone"
        title="No camera here? Request it from a phone instead"
      >
        <Smartphone className="h-4 w-4" />
      </button>

      {scanning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setScanning(false)}
        >
          <div className="glass rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Scan Wallet Address</p>
              <button onClick={() => setScanning(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <QRScanner onScan={handleScan} />
          </div>
        </div>
      )}

      {pairing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closePairing}>
          <div className="glass rounded-2xl p-6 w-full max-w-xs text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between">
              <p className="text-sm font-medium">Scan with their phone</p>
              <button onClick={closePairing} aria-label="Close">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <div className="bg-white p-3 rounded-xl inline-block">
              <QRCodeSVG value={pairingUrl(pairing.id)} size={180} />
            </div>
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Waiting for them to connect and send…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function extractAddress(decodedText) {
  try {
    const parsed = JSON.parse(decodedText);
    if (parsed?.address) return parsed.address;
  } catch {
    // Not JSON — treat the raw scanned text as the address itself.
  }
  return decodedText.trim();
}
