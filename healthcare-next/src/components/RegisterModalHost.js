"use client";

import { useWallet } from "@/context/WalletContext";
import RegisterModal from "@/components/RegisterModal";

// Rendered once at the root (layout.js) so the popup can be triggered by a
// connect() call from anywhere — Navbar, the landing page, or a dashboard's
// RoleGuard connect prompt — without each of them needing their own copy.
export default function RegisterModalHost() {
  const { showRegisterModal, setShowRegisterModal } = useWallet();
  return <RegisterModal open={showRegisterModal} onClose={() => setShowRegisterModal(false)} />;
}
