"use client";

import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useToast } from "@/context/ToastContext";

const STATUS_STYLE = {
  pending: { icon: Loader2, spin: true, border: "border-gray-200", iconColor: "text-gray-400" },
  submitted: { icon: Loader2, spin: true, border: "border-brand-pale", iconColor: "text-brand" },
  confirmed: { icon: CheckCircle2, spin: false, border: "border-medical-green-pale", iconColor: "text-medical-green" },
  reverted: { icon: XCircle, spin: false, border: "border-red-100", iconColor: "text-red-500" },
  rejected: { icon: XCircle, spin: false, border: "border-red-100", iconColor: "text-red-500" },
};

// Every contract write goes through useContractTx, which drives this stack —
// never leave a button in a silent "did it work?" state (see docs/ARCHITECTURE.md).
export default function ToastStack() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((toast) => {
        const style = STATUS_STYLE[toast.status] ?? STATUS_STYLE.pending;
        const Icon = style.icon;

        return (
          <div
            key={toast.id}
            className={`glass animate-fade-in-up rounded-xl border ${style.border} p-3 flex items-start gap-3`}
          >
            <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${style.iconColor} ${style.spin ? "animate-spin" : ""}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium break-words">{toast.label}</p>
              {toast.txHash && (
                <p className="mt-1 font-mono text-xs text-gray-500 truncate flex items-center gap-1">
                  {toast.txHash.slice(0, 10)}…{toast.txHash.slice(-8)}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-gray-400 hover:text-gray-600 text-xs shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
