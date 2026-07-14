# HealthChain — Decentralized Healthcare Ecosystem

A decentralized healthcare platform where patients own their medical
identity, providers collaborate through explicit on-chain consent, and every
medical interaction is verified and traceable — built for the "Blockchain-Based
Electronic Health Ecosystem" assignment (Group 5).

> Your Health Data. Your Ownership.

## Packages

- **[`contracts-hardhat/`](contracts-hardhat/README.md)** — 8 Solidity
  contracts (Identity, Appointments, Medical Record NFT, Medical Records,
  Access Control, Claims, Visits, Referrals), fully tested with Hardhat.
- **[`healthcare-next/`](healthcare-next/README.md)** — Next.js frontend with
  7 role dashboards (Patient, Doctor, Hospital, Laboratory, Pharmacy,
  Insurance) plus Analytics folded into the Hospital dashboard.

## Docs

- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — contract composition,
  the access-control sequence, and the design system's color discipline.
- **[`docs/SECURITY.md`](docs/SECURITY.md)** — what's actually guaranteed
  on-chain vs. the record-privacy model's explicit, deliberate limitations.
- **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)** — the full in-person, role-by-role
  walkthrough: hospital check-in, doctor↔lab↔doctor referrals, pharmacy
  dispense, and provider-submitted/patient-gated insurance claims.

## Requirements Mapping

| Assignment requirement | Delivered as |
|---|---|
| Patient/Doctor/Hospital/Pharmacy/Laboratory/Insurance registration | `IdentityRegistry.register()`, one contract for all 6 roles |
| Medical records | `MedicalRecordRegistry` |
| Medical NFTs (ERC-721) | `MedicalRecordNFT`, minted 1:1 per record |
| Appointment scheduling | `AppointmentRegistry` |
| Fine-grained RBAC | `AccessControlRegistry` — per patient-doctor, time-boxed (24h/7d/30d) grants |
| Hospital check-in / visits | `VisitRegistry` — QR-approved, hospital dispatches to a doctor as a hint only (no access-grant shortcut) |
| Doctor↔lab↔doctor referrals | `ReferralRegistry` — patient consents on both ends, layered on top of (not replacing) `AccessControlRegistry` |
| Insurance claims | `ClaimRegistry` — submitted by the treating provider, hidden from the insurer until the patient approves visibility |
| Audit logging | Indexed events across all 8 contracts, aggregated off-chain (`lib/audit.js`) — see `docs/ARCHITECTURE.md` for why this beats a redundant contract |
| IPFS storage | `api/upload/route.js` (Pinata proxy) + CID stored on-chain |
| Landing page, 7 dashboards, record viewer, appointment management, analytics | `healthcare-next/src/app/*` |

## Quick Start

See each package's README for full setup. Short version:

```bash
# 1. Contracts
cd contracts-hardhat
npm install
npx hardhat test
npx hardhat node                                    # separate terminal, leave running
npx hardhat run scripts/deploy.js --network localhost

# 2. Frontend
cd ../healthcare-next
npm install
# copy the NEXT_PUBLIC_* addresses the deploy script printed into .env.local
npm run dev
```
