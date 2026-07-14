# Architecture

## Layered overview

```
                 ┌─────────────────────────────┐
                 │   Next.js (healthcare-next) │
                 │  landing + 6 role dashboards │
                 └──────────────┬──────────────┘
                                │  ethers.js v5 (Web3Provider / signer)
                                ▼
                 ┌─────────────────────────────┐
                 │        MetaMask wallet       │
                 └──────────────┬──────────────┘
                                │
                                ▼
   ┌────────────────────────────────────────────────────────┐
   │                     Smart Contracts                     │
   │                                                          │
   │  IdentityRegistry  ◄───────────────┐                    │
   │   (roles, hospital affiliation)    │ every other         │
   │                                     │ contract resolves   │
   │  AppointmentRegistry ───────────────┤ roles by calling    │
   │   (booking, no double-booking)      │ back into this one  │
   │                                     │                     │
   │  MedicalRecordNFT (ERC-721) ◄── mint only via ─┐          │
   │                                                 │          │
   │  MedicalRecordRegistry ─────────────────────────┘          │
   │   (createRecord / dispense / revoke) ──────────────────────┤
   │                                                          │
   │  AccessControlRegistry ─────────────────────────────────┘
   │   (request / approve / deny / revoke, 24h-7d-30d)
   └────────────────────────────────────────────────────────┘
                                │
                                ▼
                 ┌─────────────────────────────┐
                 │     IPFS (via Pinata)        │
                 │  medical documents/images    │
                 └─────────────────────────────┘
```

Every contract that needs to know "who is this and what role do they hold"
calls back into `IdentityRegistry.roleOf()` rather than keeping its own copy
of role data — a role can never drift between contracts. This is the pattern
established by the original `AppointmentRegistry` and followed by every
contract added afterward.

## No dedicated audit-trail contract

Every meaningful action — registration, appointment booked/cancelled, record
created/dispensed/revoked, access requested/approved/denied/revoked — already
emits an indexed Solidity event. Those events are permanent and tamper-evident
the moment they're mined; a separate `AuditLog` contract would just re-store
the same facts a second time, at extra gas cost, with no additional trust
guarantee. Instead, `healthcare-next/src/lib/audit.js` aggregates the existing
events via `ethers.queryFilter()` across all five contracts. This one module
feeds:

- The Hospital dashboard's stat row (registrations, appointments, records, tx count).
- The Analytics dashboard's charts (day-bucketed counts).
- The Patient dashboard's implicit activity (via records/access lists).
- The landing page's trust stats (wireable to real numbers once there's
  enough on-chain activity to make them meaningful — see the phased build
  plan for when this was scheduled).

## Access-control sequence (the fine-grained RBAC centerpiece)

```
Doctor                        AccessControlRegistry                 Patient
  │                                     │                               │
  │──── requestAccess(patient) ───────►│                               │
  │                                     │──── Grant: Pending ──────────►│ (surfaced in
  │                                     │                               │  Patient dashboard)
  │                                     │◄─── approveAccess(doctor, ────│
  │                                     │      duration) ────────────── │
  │                                     │──── Grant: Approved,          │
  │                                     │      expiresAt = now+duration │
  │◄─── hasAccess(patient, doctor) ────│                               │
  │      == true (until expiresAt)     │                               │
  │                                     │                               │
  │                                     │◄─── revokeAccess(doctor) ─────│ (any time,
  │                                     │      Grant: Revoked           │  early)
```

Every doctor-facing read of a patient's records (`RecordTimeline`, the
Doctor dashboard's medical-history panel) checks `hasAccess()` first and
renders an `EmptyState` with a "Request Access" prompt if it's false — access
is never assumed.

## Frontend contract-instance pattern

`WalletContext` builds one `ethers.Contract` per deployed contract, memoized
on whichever `signer` is currently connected (or a read-only
`JsonRpcProvider` before connection, so parts of the UI — like checking
whether an address is registered — work pre-connect). Every contract *write*
goes through `useContractTx()`, which drives a shared toast
(Awaiting confirmation → Submitted → Confirmed/Reverted) — this is what
makes the blockchain layer feel trustworthy rather than a silent black box.

## Design-system color discipline

- **Healthcare Blue** (`#0B5FFF`) — primary product actions, links, active nav.
- **Medical Green** (`#00C896`) — success/verified/confirmed states *only*.
  Never decorative — green must always mean "cryptographically verified."
- **Blockchain Purple** (`#8B5CF6`) — reserved for on-chain/Web3-native
  affordances specifically: NFT badges, the audit-trail timeline rail,
  tx-hash chips. Keeps "product" and "blockchain-native" visually distinct.

Validated for categorical colorblind-safety with the palette validator
(worst adjacent pair ΔE 82.8, well above the ≥12 target) — see the Analytics
dashboard's chart colors.
