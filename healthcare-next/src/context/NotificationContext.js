"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { ROLE } from "@/lib/identityRegistry";
import { loadPendingRequestsForPatient } from "@/lib/accessControlRegistry";
import { loadPendingAffiliationRequests } from "@/lib/identityRegistry";
import { loadVisitsForPatient, loadVisitsAssignedToDoctor } from "@/lib/visitRegistry";
import { loadReferralsForPatient, loadReferralsForProvider } from "@/lib/referralRegistry";
import { loadClaimsForPatient, loadClaimsForInsurer } from "@/lib/claimRegistry";

const NotificationContext = createContext(null);
const POLL_INTERVAL_MS = 20000;

// One list of "things that need this wallet's attention right now", built
// fresh from on-chain reads every poll — the same loaders each dashboard
// already uses, just checked in the background so the bell in the Navbar
// stays current without the user having to sit on the right page. A
// per-account "seen" set (persisted to localStorage) gates the one-time
// proactive alert (toast/browser notification) so an item that's still
// pending doesn't re-alert on every single poll.
export function NotificationProvider({ children }) {
  const { account, role, contracts } = useWallet();
  const [notifications, setNotifications] = useState([]);
  const seenIdsRef = useRef(new Set());
  const storageKeyRef = useRef(null);

  useEffect(() => {
    if (!account) {
      seenIdsRef.current = new Set();
      storageKeyRef.current = null;
      return;
    }
    storageKeyRef.current = `healthchain-seen-notifications-${account.toLowerCase()}`;
    const saved = window.localStorage.getItem(storageKeyRef.current);
    seenIdsRef.current = new Set(saved ? JSON.parse(saved) : []);
  }, [account]);

  const check = useCallback(async () => {
    if (!account || role === ROLE.None) {
      setNotifications([]);
      return;
    }

    // Each data source fails independently — one contract not being
    // reachable (e.g. a placeholder address before a deploy) shouldn't blank
    // out notifications this wallet's other, working contracts already have.
    const safe = async (label, promise) => {
      try {
        return await promise;
      } catch (error) {
        console.error(`Notification check (${label}) failed:`, error.reason || error.message || error);
        return [];
      }
    };

    const items = [];
    if (role === ROLE.Patient) {
      const [accessReqs, visits, referrals, claims] = await Promise.all([
        safe("access requests", loadPendingRequestsForPatient(contracts.access, contracts.identity, account)),
        safe("visits", loadVisitsForPatient(contracts.visit, account)),
        safe("referrals", loadReferralsForPatient(contracts.referral, account)),
        safe("claims", loadClaimsForPatient(contracts.claim, account)),
      ]);
      accessReqs.forEach((r) =>
        items.push({ id: `access-${r.doctor}`, message: `${r.doctorName || "A doctor"} requested access to your records`, href: "/patient" })
      );
      visits
        .filter((v) => v.status === 0)
        .forEach((v) => items.push({ id: `visit-${v.id}`, message: "A hospital check-in is awaiting your approval", href: "/patient" }));
      referrals
        .filter((r) => r.status === 0)
        .forEach((r) => items.push({ id: `referral-${r.id}-send`, message: "A lab referral is awaiting your approval", href: "/patient" }));
      referrals
        .filter((r) => r.status === 3)
        .forEach((r) => items.push({ id: `referral-${r.id}-result`, message: "A lab result is ready to share with your doctor", href: "/patient" }));
      claims
        .filter((c) => c.status === 0)
        .forEach((c) => items.push({ id: `claim-${c.id}`, message: "An insurance claim is awaiting your approval", href: "/patient" }));
    } else if (role === ROLE.Doctor) {
      const visits = await safe("assigned visits", loadVisitsAssignedToDoctor(contracts.visit, account));
      visits
        .filter((v) => v.status === 1)
        .forEach((v) => items.push({ id: `doctor-visit-${v.id}`, message: "A checked-in patient was assigned to you", href: "/doctor" }));
    } else if (role === ROLE.Hospital) {
      const pending = await safe("affiliation requests", loadPendingAffiliationRequests(contracts.identity, account));
      pending.forEach((p) =>
        items.push({ id: `affiliation-${p.doctor}`, message: `${p.doctorName || "A doctor"} requested affiliation`, href: "/hospital" })
      );
    } else if (role === ROLE.Laboratory) {
      const referrals = await safe("lab referrals", loadReferralsForProvider(contracts.referral, account));
      referrals
        .filter((r) => r.status === 1)
        .forEach((r) => items.push({ id: `lab-referral-${r.id}`, message: "A new referral was assigned to your lab", href: "/laboratory" }));
    } else if (role === ROLE.Insurer) {
      const claims = await safe("insurer claims", loadClaimsForInsurer(contracts.claim, account));
      claims
        .filter((c) => c.status === 1)
        .forEach((c) => items.push({ id: `insurer-claim-${c.id}`, message: "A new claim is ready for review", href: "/insurer" }));
    }

    const newlySeen = items.filter((item) => !seenIdsRef.current.has(item.id));
    if (newlySeen.length > 0 && typeof Notification !== "undefined" && Notification.permission === "granted") {
      newlySeen.forEach((item) => new Notification("HealthChain", { body: item.message }));
    }

    items.forEach((item) => seenIdsRef.current.add(item.id));
    if (storageKeyRef.current) {
      window.localStorage.setItem(storageKeyRef.current, JSON.stringify([...seenIdsRef.current]));
    }
    setNotifications(items);
  }, [account, role, contracts]);

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [check]);

  const requestBrowserPermission = useCallback(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, requestBrowserPermission }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
