# HealthChain — Frontend

Next.js frontend for the Decentralized Healthcare Ecosystem. Seven role
dashboards (Patient, Doctor, Hospital, Laboratory, Pharmacy, Insurance, plus
Analytics folded into Hospital) built on top of eight Solidity contracts in
`../contracts-hardhat`. See `../docs/WORKFLOWS.md` for the full role-by-role
walkthrough.

## Why blockchain here

Every one of these has a real, verifiable trust property that a traditional
database-backed system can't offer without simply trusting an administrator:

- **Non-double-booking** — `AppointmentRegistry` enforces one doctor/timestamp
  slot on-chain; a patient can independently verify their doctor was never
  silently double-booked.
- **Patient-controlled, time-boxed sharing** — `AccessControlRegistry` means
  a doctor's access to a patient's records is a cryptographically-signed
  on-chain request/approval, not a row a hospital IT admin could quietly flip.
- **Tamper-evident audit trail** — every action across all 8 contracts emits
  an immutable event; nothing can be edited after the fact (see
  `docs/ARCHITECTURE.md`).
- **NFT-based record ownership** — each medical record is an ERC-721 owned by
  the patient, not a file sitting in a provider's database.
- **Hospital dispatch can never silently grant access** — `VisitRegistry`'s
  doctor assignment is a hint only; the doctor still needs the patient's own
  signature via `AccessControlRegistry` to see anything.
- **Provider-submitted, patient-gated insurance claims** — `ClaimRegistry`
  keeps a claim invisible to the insurer until the patient approves it, not
  the provider who filed it.

## Setup

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_*_ADDRESS` — from `../contracts-hardhat`'s deploy output (see
  that package's README).
- `PINATA_JWT` — a Pinata API key's JWT, server-side only (used by
  `src/app/api/upload/route.js`).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect MetaMask (on the
same network the contracts were deployed to), and register a role.

## Directory Map

```
src/
  app/
    page.js            landing page (hero, trust stats, how-it-works, register)
    patient/           Medical Assets, access requests, check-ins, referrals,
                       claims, appointments
    doctor/            patient search, checked-in patients, record timeline,
                       create prescription, refer to lab, hospital affiliation
    laboratory/        upload result -> IPFS -> mint record, assigned referrals,
                       file claim
    pharmacy/           QR scan -> verify -> dispense stepper, file claim
    hospital/           check-in, doctor affiliation confirm, stats, analytics
                       (all as left-menu sections on one dashboard)
    insurer/            pending/history claims, on-chain record validity check
    pair/[id]/          phone-side page for the "request address via phone"
                       pairing flow (see AddressInput below) — no dashboard,
                       no role check, just connect + send
    api/upload/         server-side Pinata proxy
    api/pair/            in-memory relay backing the pairing flow (POST creates
                       a session, phone PATCHes its address in, the desktop
                       polls GET until it arrives)
  components/          shared UI: MedicalAssetCard, RecordTimeline, RoleGuard,
                       AppointmentCalendar, CheckInPanel, LabReferralsPanel,
                       ClaimsAwaitingApproval, AddressInput, MyAddressQR,
                       ToastStack, StatCard, EmptyState...
  context/             WalletContext (on-chain role + contract instances),
                       ToastContext (tx status toasts)
  hooks/                useContractTx — every contract write goes through this
  lib/                  one file per contract: address + ABI + helpers
```

### The two ways to avoid typing an address

Every address field in this app (`AddressInput`) offers both:
- **Scan** — for when the person filling the form has a camera; reads the
  other party's `MyAddressQR` (shown from the Navbar on any connected wallet)
  directly.
- **Request via Phone** — for the common case of a front-desk laptop with no
  camera: shows a QR the *other* person scans with their own phone, which
  opens `/pair/[id]`, connects their wallet there, and sends their address
  back through `/api/pair`'s short-lived relay — it fills in on the original
  screen automatically, no typing on either side.

## Design System

See `docs/ARCHITECTURE.md` for the color-usage discipline (blue = product
actions, green = verified/confirmed only, purple = on-chain/Web3-native
affordances), and `docs/SECURITY.md` for the record-privacy model and its
explicitly-documented limitations.
