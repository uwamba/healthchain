"use client";

import { useEffect, useRef } from "react";

const ELEMENT_ID = "healthchain-qr-scanner";

// Thin wrapper around html5-qrcode's Html5QrcodeScanner — camera access
// requires a real browser (and usually HTTPS or localhost), so this is only
// ever mounted client-side. Cleans itself up on unmount so switching away
// from the scan step doesn't leave the camera stream running.
export default function QRScanner({ onScan, onError }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      const scanner = new Html5QrcodeScanner(ELEMENT_ID, { fps: 10, qrbox: 220 }, false);
      scanner.render(
        (decodedText) => {
          onScan(decodedText);
          scanner.clear().catch(() => {});
        },
        (error) => onError?.(error)
      );
      scannerRef.current = scanner;
    });

    return () => {
      cancelled = true;
      scannerRef.current?.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scanner must only be created once per mount
  }, []);

  return <div id={ELEMENT_ID} className="rounded-xl overflow-hidden" />;
}
