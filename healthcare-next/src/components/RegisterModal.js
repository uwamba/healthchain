"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import RegisterForm from "@/components/RegisterForm";

// Pops up automatically right after a successful connect() finds an
// unregistered wallet (see WalletContext.connect()) — this is the "create
// your digital health identity" step surfaced at the moment it's needed,
// instead of a permanently-inline form the user has to scroll to find.
export default function RegisterModal({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-lg my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 z-10 h-8 w-8 rounded-full bg-white shadow flex items-center justify-center text-gray-500 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold text-white drop-shadow-sm">
                Create your digital health identity
              </h3>
              <p className="text-sm text-white/85 drop-shadow-sm max-w-sm mx-auto mt-1">
                One on-chain registration unlocks your role's dashboard — no separate accounts or passwords.
              </p>
            </div>

            <RegisterForm onRegistered={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
