"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

// The other half of AddressInput's scan button — lets anyone show their own
// wallet address as a QR so someone else can scan it instead of typing it.
// Encodes the raw address (AddressInput's extractAddress() falls back to
// treating scanned text as a bare address when it isn't JSON).
export default function MyAddressQR() {
  const { account } = useWallet();
  const [open, setOpen] = useState(false);

  if (!account) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-gray-500 hover:text-foreground transition-colors"
        aria-label="Show my wallet address as a QR code"
      >
        <QrCode className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass rounded-2xl p-6 flex flex-col items-center gap-3 w-full max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between">
              <p className="font-medium text-sm">Your Wallet Address</p>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={account} size={180} />
            </div>
            <p className="font-mono text-xs text-gray-500 break-all text-center">{account}</p>
          </div>
        </div>
      )}
    </>
  );
}
