"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, Menu, X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { ROLE, roleLabel, roleSlug } from "@/lib/identityRegistry";
import RoleBadge from "@/components/RoleBadge";
import MyAddressQR from "@/components/MyAddressQR";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const { account, connect, disconnect, role, roleLoading } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const isRegistered = role !== ROLE.None;
  const dashboardHref = isRegistered ? `/${roleSlug(role)}` : null;

  const navLinks = isRegistered
    ? [{ href: dashboardHref, label: `${roleLabel(role)} Dashboard` }]
    : [];

  return (
    <header className="sticky top-0 z-40 glass border-b border-white/40">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <HeartPulse className="h-6 w-6 text-brand" />
          <span>HealthChain</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href ? "text-brand" : "text-gray-500 hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {account ? (
            <>
              {!roleLoading && <RoleBadge role={role} />}
              <span className="font-mono text-xs text-gray-500">
                {account.slice(0, 6)}…{account.slice(-4)}
              </span>
              <MyAddressQR />
              <NotificationBell />
              <button
                onClick={disconnect}
                className="text-sm font-medium text-gray-500 hover:text-foreground transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-light transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-white/40 px-4 py-3 flex flex-col gap-3">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium" onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
          {account ? (
            <div className="flex items-center justify-between pt-2 border-t border-white/40">
              <span className="font-mono text-xs text-gray-500">
                {account.slice(0, 6)}…{account.slice(-4)}
              </span>
              <div className="flex items-center gap-3">
                <MyAddressQR />
                <NotificationBell />
                <button onClick={disconnect} className="text-sm font-medium text-gray-500">
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={connect}
              className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium"
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}
    </header>
  );
}
