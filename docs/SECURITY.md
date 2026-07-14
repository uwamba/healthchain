# Security & Privacy Model

## What this app actually guarantees

- **Identity integrity** — a role, once registered in `IdentityRegistry`,
  cannot be silently changed by anyone but the account itself, and every
  other contract reads that role live rather than trusting a cached copy.
- **Consent integrity** — a doctor cannot read a patient's records through
  this app without an on-chain `AccessControlRegistry` grant the patient
  themselves approved, for a duration the patient themselves chose. The
  approval, denial, and any early revocation are all immutable, timestamped,
  on-chain facts.
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
