# HealthChain Contracts

Solidity contracts for the Decentralized Healthcare Ecosystem, built with Hardhat.

## Contracts

Deployed in this order (later contracts depend on earlier ones' addresses):

1. **`IdentityRegistry`** — single source of truth for "who is this address and
   what role do they hold" (Patient/Doctor/Hospital/Laboratory/Pharmacy/Insurer).
   Every other contract resolves roles by calling back into this one instead of
   keeping its own role store, so a role can never drift between contracts.
   Also stores each account's Curve25519 public key (for optional future
   record encryption) and a two-step doctor↔hospital affiliation flow.

2. **`AppointmentRegistry`** — books/cancels patient↔doctor appointments.
   Deliberately thin: its one real trust property is that a doctor can never
   be silently double-booked at the same timestamp, enforced by the contract
   itself rather than a database an administrator could quietly edit.

3. **`MedicalRecordNFT`** — ERC-721 (OpenZeppelin `ERC721URIStorage`) where
   each token is a verified medical record owned by the patient. Minting is
   restricted to a single `minter` address, set once post-deploy to
   `MedicalRecordRegistry`'s address.

4. **`MedicalRecordRegistry`** — the core clinical-data contract. Authorized
   issuers (Doctor/Hospital/Laboratory/Pharmacy) create records for a patient;
   each `createRecord()` call mints the corresponding `MedicalRecordNFT`.
   Also handles marking a `Prescription`-type record as dispensed (the
   on-chain half of the pharmacy QR-verification flow) and revocation.

5. **`AccessControlRegistry`** — the fine-grained RBAC centerpiece. A doctor
   requests access to a patient's records; only the patient can approve it
   for a fixed duration (24h/7d/30d), deny it, or revoke it early. Every
   doctor-facing read checks `hasAccess()` first.

6. **`ClaimRegistry`** — insurance claims, submitted by the treating
   *provider* (Hospital/Laboratory/Pharmacy), not the patient. A claim is
   invisible to the insurer until the patient explicitly approves it —
   that approval, not the initial submission, is the patient's real
   consent action (done in person, right after the service).

7. **`VisitRegistry`** — models a physical hospital visit: the hospital
   opens a check-in request for a patient who has walked in, the patient
   confirms it (in practice via a QR that deep-links to this exact request
   on their own phone), and the hospital may dispatch the visit to a
   doctor. The dispatch is a hint only — it does not grant record access;
   the doctor still goes through `AccessControlRegistry`'s own
   request/approve flow, so a compromised Hospital account can never grant
   access without the patient's own signature.

8. **`ReferralRegistry`** — a doctor refers a patient to a laboratory,
   gated by patient consent on both ends: sending the referral to the lab,
   and sending the lab's result back to the referring doctor. Deliberately
   does not grant view access itself — that still flows through the one,
   unmodified `AccessControlRegistry` grant; this contract is a consent/audit
   record layered on top, not a second overlapping access-control system.

**No dedicated audit-trail contract.** Every action above already emits an
indexed event (`Registered`, `AppointmentBooked`, `RecordCreated`,
`AccessApproved`, etc.). These are aggregated off-chain by the frontend
(`healthcare-next/src/lib/audit.js` via `ethers.queryFilter()`) rather than
re-stored redundantly on-chain — see `docs/SECURITY.md` at the project root
for the reasoning.

## Setup

```bash
npm install
```

## Commands

```bash
npx hardhat compile        # compile all contracts
npx hardhat test           # run the full test suite
npx hardhat node           # start a local chain (leave running in its own terminal)
npx hardhat run scripts/deploy.js --network localhost   # deploy to that local chain
```

`scripts/deploy.js` deploys all 8 contracts in dependency order, wires
`MedicalRecordNFT`'s minter to `MedicalRecordRegistry`, writes the resulting
addresses to `deployments/<network>.json`, and prints `NEXT_PUBLIC_*` lines
ready to paste into `healthcare-next/.env.local`.

For a Sepolia deploy instead of/alongside local: fill in `SEPOLIA_RPC_URL` and
`DEPLOYER_PRIVATE_KEY` in a `.env` file (see `.env.example`; use a dedicated
test wallet, never one holding real funds), then:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## Deployed Addresses

Filled in after each deploy (see `deployments/<network>.json` for the
machine-readable version):

See `deployments/<network>.json` for the machine-readable, always-current
version (written fresh on every deploy) — this table is not kept in sync by
hand since it changes on every redeploy.

## Test Coverage

52 tests across 8 contracts, covering the happy path, every `require()`
guard, and the key trust properties each contract exists to enforce
(non-double-booking, one-time minter lock, time-boxed access expiry,
per-doctor grant independence, provider-can-only-claim-its-own-records,
referral/visit consent gates on both ends). Run with `npx hardhat test`.
