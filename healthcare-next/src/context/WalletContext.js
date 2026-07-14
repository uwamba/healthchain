"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, ROLE, roleSlug } from "@/lib/identityRegistry";
import { APPOINTMENT_REGISTRY_ADDRESS, APPOINTMENT_REGISTRY_ABI } from "@/lib/appointmentRegistry";
import { MEDICAL_RECORD_NFT_ADDRESS, MEDICAL_RECORD_NFT_ABI } from "@/lib/medicalRecordNFT";
import { MEDICAL_RECORD_REGISTRY_ADDRESS, MEDICAL_RECORD_REGISTRY_ABI } from "@/lib/medicalRecordRegistry";
import { ACCESS_CONTROL_REGISTRY_ADDRESS, ACCESS_CONTROL_REGISTRY_ABI } from "@/lib/accessControlRegistry";
import { CLAIM_REGISTRY_ADDRESS, CLAIM_REGISTRY_ABI } from "@/lib/claimRegistry";
import { VISIT_REGISTRY_ADDRESS, VISIT_REGISTRY_ABI } from "@/lib/visitRegistry";
import { REFERRAL_REGISTRY_ADDRESS, REFERRAL_REGISTRY_ABI } from "@/lib/referralRegistry";

const WalletContext = createContext(null);

// Used only for read-only access before a wallet is connected, and as the
// runner for every contract read once connected to a network other than the
// one the wallet's provider is actually on. Must match whichever network
// NEXT_PUBLIC_*_ADDRESS actually points at (set NEXT_PUBLIC_READ_ONLY_RPC in
// .env.local — defaults to Sepolia's public RPC, matching contracts-hardhat's
// own default; point it at http://127.0.0.1:8545 instead for local Hardhat).
const READ_ONLY_RPC = process.env.NEXT_PUBLIC_READ_ONLY_RPC || "https://ethereum-sepolia-rpc.publicnode.com";

export function WalletProvider({ children }) {
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [signer, setSigner] = useState(null);

  // Drives the registration popup — opened automatically right after a
  // successful connect() if the wallet turns out to be unregistered, so
  // "Connect" itself is the one onboarding action (see connect() below).
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // `role` is the authoritative on-chain fact from IdentityRegistry.roleOf(),
  // never a client preference — every contract write here is gated by the
  // real role, so trusting anything else would let a user land on a
  // dashboard where every transaction silently reverts.
  const [role, setRole] = useState(ROLE.None);
  const [roleLoading, setRoleLoading] = useState(false);

  // Cosmetic-only: remembers the last dashboard visited so the landing page
  // can offer a "Continue as Doctor" shortcut before a wallet reconnects.
  // Never used for authorization — must start null on both server and first
  // client render (SSR has no localStorage) or React hydration mismatches.
  const [lastDashboard, setLastDashboardState] = useState(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("healthchain-last-dashboard");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: restoring client-only localStorage state post-hydration, not mirroring a prop/state value
    if (saved) setLastDashboardState(saved);
  }, []);

  const setLastDashboard = useCallback((slug) => {
    setLastDashboardState(slug);
    window.localStorage.setItem("healthchain-last-dashboard", slug);
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setSigner(null);
    setRole(ROLE.None);
  }, []);

  const connect = useCallback(async () => {
    if (typeof window.ethereum === "undefined") {
      alert(
        "No wallet extension detected in this browser (window.ethereum is undefined). " +
          "Make sure MetaMask is installed and enabled for this site."
      );
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const connectedAccount = accounts[0];

      setAccount(connectedAccount);
      setChainId(currentChainId);
      setSigner(provider.getSigner());

      // Resolve the role directly against a fresh contract instance here,
      // rather than waiting on the memoized `contracts`/refreshRole effect
      // (which won't reflect the new signer until the next render) — this is
      // what lets "Connect" itself route straight to the dashboard if already
      // registered, or open the registration popup if not, instead of just
      // connecting and leaving the user to find their own way.
      const identity = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, provider);
      const onChainRole = await identity.roleOf(connectedAccount);
      setRole(onChainRole);

      if (onChainRole === ROLE.None) {
        setShowRegisterModal(true);
      } else {
        router.push(`/${roleSlug(onChainRole)}`);
      }
    } catch (error) {
      console.error("Wallet connect failed:", error);
      alert(error?.message || "Failed to connect wallet. Check the browser console for details.");
    }
  }, [router]);

  useEffect(() => {
    if (typeof window.ethereum === "undefined") return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(accounts[0]);
      }
    };
    const handleChainChanged = (newChainId) => setChainId(newChainId);

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect]);

  const contracts = useMemo(() => {
    const runner = signer || new ethers.providers.JsonRpcProvider(READ_ONLY_RPC);
    return {
      identity: new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, runner),
      appointment: new ethers.Contract(APPOINTMENT_REGISTRY_ADDRESS, APPOINTMENT_REGISTRY_ABI, runner),
      nft: new ethers.Contract(MEDICAL_RECORD_NFT_ADDRESS, MEDICAL_RECORD_NFT_ABI, runner),
      records: new ethers.Contract(MEDICAL_RECORD_REGISTRY_ADDRESS, MEDICAL_RECORD_REGISTRY_ABI, runner),
      access: new ethers.Contract(ACCESS_CONTROL_REGISTRY_ADDRESS, ACCESS_CONTROL_REGISTRY_ABI, runner),
      claim: new ethers.Contract(CLAIM_REGISTRY_ADDRESS, CLAIM_REGISTRY_ABI, runner),
      visit: new ethers.Contract(VISIT_REGISTRY_ADDRESS, VISIT_REGISTRY_ABI, runner),
      referral: new ethers.Contract(REFERRAL_REGISTRY_ADDRESS, REFERRAL_REGISTRY_ABI, runner),
    };
  }, [signer]);

  const refreshRole = useCallback(async () => {
    if (!account) {
      setRole(ROLE.None);
      return;
    }
    setRoleLoading(true);
    try {
      const onChainRole = await contracts.identity.roleOf(account);
      setRole(onChainRole);
    } catch (error) {
      console.error("Failed to read on-chain role:", error);
    } finally {
      setRoleLoading(false);
    }
  }, [account, contracts.identity]);

  // Re-derive the authoritative role every time the connected account (or
  // the contract instance backing it) changes — a stale role must never
  // outlive the account it was read for.
  useEffect(() => {
    refreshRole();
  }, [refreshRole]);

  return (
    <WalletContext.Provider
      value={{
        account,
        chainId,
        connect,
        disconnect,
        contracts,
        role,
        roleLoading,
        refreshRole,
        lastDashboard,
        setLastDashboard,
        showRegisterModal,
        setShowRegisterModal,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
