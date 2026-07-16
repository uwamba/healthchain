# Security & Privacy Model

## What this app actually guarantees

- **Identity integrity** — a role, once registered in `IdentityRegistry`,
  cannot be silently changed by anyone but the account itself, and every
  other contract reads that role live rather than trusting a cached copy.
- **Consent integrity** — a doctor or pharmacy cannot read a patient's
  records through this app without an on-chain `AccessControlRegistry`
  grant the patient themselves approved, for a duration the patient
  themselves chose. (`requestAccess` accepts either role — one grant
  lifecycle, not two parallel access-control systems — see
  `docs/ARCHITECTURE.md`.) The approval, denial, and any early revocation
  are all immutable, timestamped, on-chain facts.
- **Insurance claim visibility is patient-gated (for Hospital/Laboratory)
  and always time-boxed** — a Hospital or Laboratory claim is invisible to
  the insurer until the patient calls `approvePatientVisibility()`, and
  that approval only opens a 30-day window (`ClaimRegistry.VISIBILITY_PERIOD`)
  rather than permanent access. A Pharmacy claim skips straight to that same
  30-day window on submission — deliberately, not an oversight: by the time
  a pharmacy dispenses a prescription, the patient has already consented
  once already (presenting their own prescription QR, or approving the
  pharmacy's `AccessControlRegistry` request), so a third approval just to
  let their own insurer see the claim would be a redundant gate rather than
  an additional safeguard. A record can never be attached to more than one
  claim (`recordClaimed`), so batching many unbilled records into one
  monthly claim can't accidentally double-bill the same service.
- **Non-repudiation of clinical actions** — every record creation,
  prescription dispense, and appointment booking/cancellation is an
  irreversible, indexed blockchain event. No administrator can quietly edit
  or delete this history after the fact.

## What this app does *not* guarantee (read this before treating it as a
compliance-grade medical records system)

**On-chain data, including the IPFS CID stored per record, is publicly
readable by anyone who queries the chain directly — regardless of what
`AccessControlRegistry.hasAccess()` returns.**

This matters because:

1. A Solidity `view` function call (`eth_call`) requires no signature. A
   `require(msg.sender == ...)` check inside a view function only restricts
   what *this app's UI* will choose to show — a party willing to read chain
   state or IPFS directly, bypassing the frontend entirely, is not stopped
   by that check.
2. `hasAccess()` is therefore a **policy gate enforced by the trusted
   frontend plus an immutable on-chain consent trail** — not cryptographic
   secrecy. It proves *who was authorized and when*, which is what the audit
   trail is for. It does not make the underlying document unreadable to a
   sufficiently motivated party querying the chain/IPFS gateway directly.
3. IPFS itself is a public, content-addressed store — pinning a file there
   makes it retrievable by anyone who has (or brute-forces/guesses) the CID,
   independent of anything this app's contracts say.

This is a **deliberate, accepted trade-off for the project's scope and
timeline**, not an oversight: the assignment's "Fine-Grained RBAC" and "IPFS"
requirements are about verifiable, on-chain-enforced access control and
decentralized storage — both of which this app delivers — not about
cryptographic confidentiality of the documents themselves.

## The claim visibility window is the same trade-off, made explicit

Once a claim's 30-day window lapses, this app's UI stops *showing* the
insurer the description and attached record ids — but exactly as with
`hasAccess()` above, `claims(claimId)` is a public `view` getter. Anyone
querying the chain directly can still read every field, at any time,
window or no window. What actually changes at expiry:

1. **`loadClaimsForInsurer()` blanks the description/recordIds client-side**
   once `hasFullVisibility()` returns false — a frontend policy gate, not
   encryption, identical in kind to the record-access gate above.
2. **The non-sensitive stub (id, provider/insurer address, amount, dates)
   was never hidden in the first place** — it's exactly what
   `ClaimSubmitted`'s event args already carry, which is why it stays
   visible in the Hospital/Patient Activity Logs regardless of window
   state; there's no separate "public ledger" contract because the event
   log already *is* one.
3. **Renewal is a fresh patient signature, not a technical unlock** — the
   contract doesn't "know" the description any less after expiry than
   before; `approveVisibilityRenewal()` just re-authorizes the frontend to
   show it again, same consent model as the original approval.

If a future iteration wanted the description itself to be unreadable after
expiry (not just unshown), it would need the same Curve25519 envelope
approach below, applied to the claim description rather than the record
CID — genuinely revoking a decryption key isn't possible either, but
re-wrapping to a rotating key per window is the closest on-chain-friendly
analogue, and was out of scope here for the same timeline reasons.

## The stretch path that would close this gap

`IdentityRegistry` already scaffolds Curve25519 public keys per account
(`publicKeyOf` / `setPublicKey`) for exactly this purpose. A follow-on
iteration could:

1. Generate a random symmetric key per record, client-side.
2. Encrypt the document with it before upload, so the IPFS-hosted file is
   ciphertext, not plaintext.
3. `nacl.box()` that symmetric key to the patient's own public key (so the
   patient can always decrypt their own records) and store that wrapped key
   reference alongside the record.
4. On `approveAccess()`, have the patient's browser (which can already
   decrypt) re-wrap the same symmetric key to the requesting doctor's public
   key, so only the doctor's private key — never present on-chain or
   server-side — can unwrap it.

This was scoped as optional, single-record-showcase polish rather than a
whole-app requirement, given the project's timeline — see the phased build
plan for exactly where it was slotted in (last, cut first if behind).
