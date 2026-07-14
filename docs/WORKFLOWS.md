# End-to-End Workflows

How a patient actually moves through the system — hospital, doctor, laboratory,
pharmacy, insurance — and exactly who can do what to whom. This reflects the
built, working system across 8 contracts (`contracts-hardhat/contracts/`) and
7 dashboards (`healthcare-next/src/app/`).

## The QR mechanic, once, up front

Every "scan a QR to approve" step below works the same way: an on-chain
request already exists (created by whichever provider), the QR encodes a
deep link to it, the **patient's own phone** scans it with its native camera
(no in-app scanner needed on the patient's side), opens their own Patient
dashboard with that item highlighted, and they tap Approve — a real
transaction signed by their own wallet. The QR is a physical-world shortcut
to the right pending item, never a bypass around the patient's own signature.
The one exception in the other direction is the Pharmacy flow, where the
*patient* generates a QR (from a Prescription record's "Show QR" button) and
the *pharmacist* scans it.

## 1. Onboarding (identity — once per wallet)

```
Connect Wallet
    │
    ▼
WalletContext.connect() calls IdentityRegistry.roleOf(address) directly
    │
    ├─ role == None  → registration modal opens: pick role + name
    │                    (+ organization, for Hospital/Lab/Pharmacy/Insurer)
    │                    → IdentityRegistry.register() → dashboard
    │
    └─ role != None  → straight to that role's dashboard
```

## 2. Hospital check-in (the physical visit)

```
Hospital Dashboard — "Check-In" tab
  Enter patient's address → requestVisit(patient)
    │
    ▼
  QR shown (deep-links to the patient's dashboard for this visit)
    │
    ▼
Patient scans it (or already has the app open) → Pending Check-Ins panel
    │
    ▼
Patient taps "Confirm Check-In" → VisitRegistry.approveVisit()
    │
    ▼
Hospital's "Checked-In — Assign a Doctor" list shows the patient
    │
    ▼
Hospital enters a doctor's address → assignDoctor(visitId, doctor)
```

`assignDoctor` is a **dispatch hint only** — it does not grant the doctor
record access by itself. It never touches `AccessControlRegistry`. This is
deliberate: a compromised Hospital account must never be able to grant a
doctor access to a patient's records without the patient's own signature.

## 3. Doctor sees the checked-in patient and requests access

```
Doctor Dashboard — "Checked-In Patients" panel
  (patients this hospital assigned to this doctor, VisitRegistry lookup)
    │
    ▼
  "Request Access" → AccessControlRegistry.requestAccess(patient)
    │
    ▼
Patient's "Access Requests" panel shows it (same panel as any doctor's
direct request via Patient Search — this is the one, unmodified access-
control system in the whole app)
    │
    ▼
Patient picks 24h / 7d / 30d, approves → approveAccess()
    │
    ▼
Doctor's Medical History / RecordTimeline for this patient unlocks
```

## 4. Doctor examines, records a prescription, and (if needed) refers to a lab

```
Doctor Dashboard (patient selected, access granted)
  "Create Prescription / Consultation Note" → createRecord(patient, type, cid)
    → mints a MedicalRecordNFT to the patient, visible immediately on their
      Medical Assets grid

  "Refer to Lab" → enter lab address + reason → ReferralRegistry.createReferral()
    │
    ▼
  Patient's "Lab Referrals" panel: Approve ("Send to Lab") or Deny
    │
    ▼ (approved)
  Laboratory Dashboard — "Assigned Referrals": upload the result file
    → IPFS → createRecord(LabResult) (same MedicalRecordRegistry path as
      any lab result) → completeReferral(referralId, newRecordId)
    │
    ▼
  Patient's "Lab Referrals" panel: "Share Result With Doctor" →
    approveReferralResult()
```

**Important:** `approveReferralResult` is a consent/audit record — "the
patient explicitly authorized sharing this specific result with this
specific doctor" — not the actual visibility mechanism. The doctor only
*sees* the new lab record because they already hold (or separately obtain)
an `AccessControlRegistry` grant for that patient, exactly as in step 3.
Referrals and access grants are deliberately two separate, non-overlapping
systems rather than one trying to do both jobs.

## 5. Pharmacy: two ways in, same dispense action

**Fast path — patient shows a specific prescription's QR:**

```
Patient's Medical Assets grid: a Prescription + Active record has a
"Show QR" button (encodes { recordId })
    │
    ▼
Patient shows it to the pharmacist
    │
    ▼
Pharmacy Dashboard — "Quick Dispense": Scan → Verify → Dispense stepper
  Scan (or type the id) → records(recordId) [read]
   → verify recordType == Prescription && status == Active
    │
    ▼
  "Dispense Medication" → dispensePrescription(recordId)
    → status flips to Dispensed (blocks re-dispensing the same script)
```

**Consent-gated path — pharmacy looks the patient up by address:**

```
Pharmacy Dashboard — "Patient Lookup" (address input or scan the patient's
own MyAddressQR / phone-pairing, same AddressInput component every other
address-entry field in this app uses)
    │
    ▼
  "Request Access" → AccessControlRegistry.requestAccess(patient)
    (requestAccess now accepts a Doctor OR a Pharmacy caller — same
    contract, same request→approve→time-box→revoke lifecycle, not a
    second access-control system)
    │
    ▼
Patient's "Access Requests" panel — same panel a doctor's request shows
up in, labeled with a role badge so the patient can tell them apart
    │
    ▼
Patient picks 24h / 7d / 30d, approves → approveAccess()
    │
    ▼
Pharmacy's "My Patients" list gains this patient (no need to look them up
again); their Prescription-type records become visible, each dispensable
```

Both paths call the exact same `dispensePrescription(recordId)` — the
difference is purely how the pharmacy found the record, not what dispensing
does.

## 6. Insurance claims — filed by the provider, gated by the patient, time-boxed

```
Pharmacy (after dispense, or batched later — see below) / Laboratory
  "File Insurance Claim": insurer address + description + amount + one or
  more recordIds this same provider issued
    → ClaimRegistry.submitClaim(patient, insurer, [recordIds...], ...)
    → status: AwaitingPatientApproval (insurer can't see or act on it yet)
    → each attached recordId is marked claimed — it can never be attached
      to a second claim, even a rejected one
    │
    ▼
Patient's "Claims Awaiting Your Approval" panel
  Approve → approvePatientVisibility() → status: Pending, opens a 30-day
    full-visibility window (visibilityExpiresAt = now + 30 days)
  Deny    → denyPatientVisibility()    → insurer never sees it
    │
    ▼
Insurance Dashboard — "Pending Claims" / "Claim History"
  While hasFullVisibility(claimId) is true: description, attached records
  (cross-checked live against MedicalRecordRegistry — "blockchain
  validity" is this check, not a separate contract state), and Approve/
  Reject are all shown, same as before
    │
    ▼
  Approve / Reject → claim resolved, moves to "Claim History"
```

**Batching, since there's no on-chain scheduler:** Pharmacy's dashboard has
a "Batch Insurance Claims" panel listing every dispensed prescription that
hasn't been billed yet, grouped by patient — the pharmacist selects several
and submits one claim per patient whenever they choose to reconcile (e.g.
monthly). This works because `submitClaim` already accepts an array of
`recordIds`; "monthly" is a habit the pharmacist keeps, not a rule the
contract enforces (there is no cron/scheduler in Solidity, and a server
auto-signing transactions on the pharmacy's behalf would mean a custodial
hot wallet — the one thing this whole app is built to avoid).

**After the 30-day window lapses:** `hasFullVisibility` flips false. The
insurer's dashboard stops showing the description and attached records —
only the claim id, provider/insurer address, amount, and dates remain, the
same non-sensitive fields already carried by `ClaimSubmitted`'s event log.
A "Request Renewal" button appears instead of Approve/Reject;
`requestVisibilityRenewal()` (provider or insurer) surfaces on the
patient's "Claim Visibility Renewals" panel, and only the patient's own
`approveVisibilityRenewal()` reopens a fresh 30-day window. See
`docs/SECURITY.md` for why this is a frontend policy gate rather than
actual encryption, same as every other "gated" view in this app.

Submission is the provider's paperwork; the patient's approval — not the
submission — is their real consent action, matching how this actually works
in person (done right after the service, e.g. at the pharmacy counter).

**Scope note:** Hospital is a contractually-valid claim submitter too
(`ClaimRegistry.submitClaim` accepts Hospital/Laboratory/Pharmacy), but the
current Hospital dashboard doesn't issue `MedicalRecordRegistry` records
itself (only Doctor and Laboratory do, plus Pharmacy's dispense action), and
a claim can only attach records the submitting provider actually issued. So
hospital-initiated claims are supported on-chain but not yet reachable from
the Hospital dashboard's UI — flagged here rather than silently left out.

## Per-Role Capability Summary

| Role | Registers with | Can do |
|---|---|---|
| **Patient** | name only | Approve/cancel hospital check-ins; approve/deny doctor access requests (24h/7d/30d) and revoke early; approve/deny lab referrals both directions; approve/deny claim visibility; book/cancel appointments; always see their own full record history |
| **Doctor** | name only | See patients checked in and assigned to them; request access to any patient (address lookup or via a checked-in assignment); once granted, view history and create Consultation/Prescription records; refer to a lab; request hospital affiliation |
| **Hospital** | name + organization | Check in a walked-in patient (QR); assign a checked-in patient to a doctor; confirm a doctor's affiliation request; view network-wide stats, activity log, and analytics |
| **Laboratory** | name + organization | Create LabResult/Imaging records for any registered patient directly; see and complete referrals assigned to them; file insurance claims for records they issued |
| **Pharmacy** | name + organization | Scan/verify a Prescription record and dispense it once (fast path); or look a patient up by address, request access, and once approved see their Prescription records and dispense from a persistent "My Patients" list; batch several unbilled dispensed prescriptions into one claim per patient whenever they choose |
| **Insurance** | name + organization | See claims only after the patient approves visibility, for a 30-day window; cross-check record validity; approve/reject; request renewal once the window lapses |

## Architecture note: why 3 new contracts, not fewer

`ClaimRegistry`, `VisitRegistry`, and `ReferralRegistry` each model a
distinct consent relationship (provider→insurer visibility, hospital→patient
check-in, doctor→lab→doctor referral) and none of them duplicate
`AccessControlRegistry`'s job of gating a doctor's ongoing view of a
patient's record timeline — that stays the one place doctor access is
decided. Keeping these separate, rather than overloading one contract or
letting a hospital's dispatch action implicitly grant access, means every
consent-sensitive action in this system requires the specific party whose
consent actually matters to sign for it themselves. See
`docs/ARCHITECTURE.md` for the contract composition pattern shared across
all 8, and `docs/SECURITY.md` for what this app does and doesn't guarantee
about privacy.
