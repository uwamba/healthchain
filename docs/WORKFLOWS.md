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
    ├─ role == None  → registration modal opens: pick role + name + phone
    │                    + an ID number (national ID/passport for a patient,
    │                    license/registration number for every other role)
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
Hospital's "Checked-In — Assign a Doctor" list shows the patient (also
summarized on the Overview tab as "Currently Checked-In")
    │
    ▼
Hospital picks a doctor from a dropdown of its own confirmed-affiliated
doctors (see "Affiliated Doctors" below) → assignDoctor(visitId, doctor)
```

`assignDoctor` is a **dispatch hint only** — it does not grant the doctor
record access by itself. It never touches `AccessControlRegistry`. This is
deliberate: a compromised Hospital account must never be able to grant a
doctor access to a patient's records without the patient's own signature.

**Affiliated Doctors roster:** the Hospital dashboard's "Doctor Affiliations"
tab shows both pending affiliation requests (§1) and, below them, every
doctor whose affiliation has already been confirmed — the same roster the
Check-In tab's assignment dropdown draws from, found via the
`HospitalAffiliationConfirmed` event log rather than a free-text address
(a hospital dispatches to its own staff, not an arbitrary registered
doctor).

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

## 6. Insurance claims — filed by the provider, time-boxed, gated for Hospital/Lab only

```
Pharmacy (after dispense, or batched later) / Hospital (batched from Billing
& Claims) / Laboratory
  "File Insurance Claim": insurer address + description + amount + one or
  more recordIds this same provider either issued OR (Pharmacy only)
  actually dispensed — a prescription's issuer is the prescribing doctor,
  but it's the dispensing pharmacy that rendered the billable service and
  can claim for it
    → ClaimRegistry.submitClaim(patient, insurer, [recordIds...], ...)
    → each attached recordId is marked claimed — it can never be attached
      to a second claim, even a rejected one
    │
    ├─ Pharmacy submitter → status: Pending immediately, visibility window
    │    already open (visibilityExpiresAt = now + 30 days) — see below for
    │    why this one provider skips the patient-approval step
    │
    └─ Hospital / Laboratory submitter → status: AwaitingPatientApproval
         │
         ▼
       Patient's "Claims Awaiting Your Approval" panel
         Approve → approvePatientVisibility() → status: Pending, opens the
           same 30-day full-visibility window
         Deny    → denyPatientVisibility()    → insurer never sees it
    │
    ▼
Insurance Dashboard — "Pending Claims" / "Claim History"
  While hasFullVisibility(claimId) is true: description, attached records
  (cross-checked live against MedicalRecordRegistry — "blockchain
  validity" is this check, not a separate contract state), and Approve/
  Reject are all shown
    │
    ▼
  Approve / Reject → claim resolved, moves to "Claim History"
```

**Why Pharmacy skips patient approval and Hospital/Laboratory don't:** by
the time a pharmacy dispenses a prescription, the patient has already
consented once already — either by presenting their own prescription QR in
person, or by approving the pharmacy's `AccessControlRegistry` access
request (§5). Requiring a *third* consent action just to let the patient's
own insurer see the claim would be a redundant gate, not an additional
safeguard, so `submitClaim` sets a Pharmacy claim straight to `Pending`
with its visibility window already open (emits `ClaimAutoApproved` instead
of waiting on `ClaimPatientApproved`). Hospital and Laboratory claims aren't
necessarily preceded by any equivalent patient-side consent action, so they
keep the explicit approval gate.

**Batching, since there's no on-chain scheduler:** Pharmacy's dashboard has
a "Batch Insurance Claims" panel, and Hospital's "Billing & Claims" tab has
the same panel under "File Insurance Claims" — both list every unbilled
record grouped by patient, letting the provider select several and submit
one claim per patient whenever they choose to reconcile (e.g. monthly).
This works because `submitClaim` already accepts an array of `recordIds`;
"monthly" is a habit the provider keeps, not a rule the contract enforces
(there is no cron/scheduler in Solidity, and a server auto-signing
transactions on the provider's behalf would mean a custodial hot wallet —
the one thing this whole app is built to avoid).

**After the 30-day window lapses:** `hasFullVisibility` flips false. The
insurer's dashboard stops showing the description and attached records —
only the claim id, provider/insurer address, amount, and dates remain, the
same non-sensitive fields already carried by `ClaimSubmitted`'s event log.
A "Request Renewal" button appears instead of Approve/Reject;
`requestVisibilityRenewal()` (provider or insurer) surfaces on the
patient's "Claim Visibility Renewals" panel, and only the patient's own
`approveVisibilityRenewal()` reopens a fresh 30-day window. This applies
equally to a Pharmacy claim's window once its initial 30 days lapse. See
`docs/SECURITY.md` for why this is a frontend policy gate rather than
actual encryption, same as every other "gated" view in this app.

**Hospital billing:** the Hospital dashboard's "Billing & Claims" tab has a
"Log Service / Bill" form — `createRecord(patient, type, cid)` for a
checked-in patient, for any type except Prescription (Consultation,
LabResult, Imaging, Discharge, Vaccination), since prescriptions stay a
doctor's clinical act tied to the pharmacy dispense flow. Logged services
that haven't been claimed yet feed directly into the same batch-claim panel
described above.

## 7. Appointments — separate from the in-person visit flow

```
Patient Dashboard — "Book Appointment"
  Doctor address + date/time + reason → AppointmentRegistry.bookAppointment()
    → reserves the slot immediately (no other patient can request the same
      doctor at the same timestamp) but status starts at Requested
    │
    ▼
Doctor's "Pending Appointment Requests" panel
  Confirm → confirmAppointment() → status: Confirmed
  Decline → declineAppointment() → status: Declined, slot freed for rebooking
    │
    ▼
Either side can still cancelAppointment() while Requested or Confirmed,
freeing the slot the same way a decline does
```

This is the same request→approve shape as everything else in this app —
booking a slot doesn't settle anything by itself, the doctor's own
confirmation does.

## Per-Role Capability Summary

| Role | Registers with | Can do |
|---|---|---|
| **Patient** | name, phone, National ID/passport | Approve/cancel hospital check-ins; approve/deny doctor access requests (24h/7d/30d) and revoke early; approve/deny lab referrals both directions; approve/deny claim visibility; book/cancel appointments; always see their own full record history |
| **Doctor** | name, phone, medical license # | See patients checked in and assigned to them; request access to any patient (address lookup or via a checked-in assignment); once granted, view history and create Consultation/Prescription records; refer to a lab; request hospital affiliation |
| **Hospital** | name, phone, org, license # | Check in a walked-in patient (QR); assign a checked-in patient to one of its own affiliated doctors (dropdown); confirm a doctor's affiliation request and see its full affiliated-doctor roster; log a billable service (Consultation/LabResult/Imaging/Discharge/Vaccination) for a checked-in patient; batch unbilled services into insurance claims (still patient-approval-gated); view network-wide stats, activity log, and analytics |
| **Laboratory** | name, phone, org, license # | Create LabResult/Imaging records for any registered patient directly; see and complete referrals assigned to them; file insurance claims for records they issued |
| **Pharmacy** | name, phone, org, license # | Scan/verify a Prescription record and dispense it once (fast path); or look a patient up by address, request access, and once approved see their Prescription records and dispense from a persistent "My Patients" list; batch several unbilled dispensed prescriptions into one claim per patient whenever they choose — visible to the insurer immediately, no patient approval step |
| **Insurance** | name, phone, org, license # | See Hospital/Laboratory claims only after the patient approves visibility (Pharmacy claims are visible immediately), for a 30-day window; cross-check record validity; approve/reject; request renewal once the window lapses |

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
