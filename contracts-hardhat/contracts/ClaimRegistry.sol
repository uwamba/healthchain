// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IdentityRegistry.sol";
import "./MedicalRecordRegistry.sol";

/// @title ClaimRegistry
/// @notice Insurance claims, submitted by the provider that rendered a
/// service (Hospital/Laboratory/Pharmacy), not the patient. A Hospital or
/// Laboratory claim is invisible to the insurer until the patient
/// explicitly approves it — that approval, not the initial submission, is
/// the patient's actual consent action, matching how a real in-person visit
/// works (the provider files the paperwork; the patient signs off before it
/// goes out). A Pharmacy claim skips this step and is visible immediately:
/// by the time a pharmacy dispenses a prescription, the patient has already
/// consented once already — either by presenting their own prescription QR
/// in person, or by approving the pharmacy's AccessControlRegistry access
/// request — so a second approval to simply let their own insurer see the
/// claim would be a redundant gate, not an additional safeguard.
/// @dev Composes with IdentityRegistry and MedicalRecordRegistry the same
/// way every other contract in this system does — immutable references,
/// no duplicated state.
///
/// Visibility is also time-boxed: approval opens a VISIBILITY_PERIOD (30
/// days) window during which the insurer can see full claim detail
/// (description, attached records, exact amount). Once it lapses,
/// hasFullVisibility() flips false and the frontend falls back to showing
/// only the non-sensitive stub already carried by this contract's own
/// events (id, provider/insurer address, amount, timestamp) — the same
/// "on-chain data is publicly readable regardless of a status flag" limit
/// documented in docs/SECURITY.md, made deliberate here rather than
/// pretending the description field is ever truly hidden from a raw RPC
/// call. Anyone needing the full detail again after expiry must have the
/// patient explicitly renew it (requestVisibilityRenewal / approveVisibilityRenewal).
contract ClaimRegistry {
    IdentityRegistry public immutable identityRegistry;
    MedicalRecordRegistry public immutable medicalRecordRegistry;

    uint256 public constant VISIBILITY_PERIOD = 30 days;

    enum ClaimStatus { AwaitingPatientApproval, Pending, Approved, Rejected, PatientDenied }

    struct Claim {
        uint256 id;
        address patient;
        address provider;
        address insurer;
        uint256[] recordIds;
        string description;
        uint256 amount;
        ClaimStatus status;
        uint256 createdAt;
        uint256 visibilityExpiresAt;
    }

    Claim[] public claims;
    mapping(address => uint256[]) public claimsOfPatient;
    mapping(address => uint256[]) public claimsOfProvider;
    mapping(address => uint256[]) public claimsOfInsurer;

    /// @dev Sticky, one-way flag per record — once a record has been attached
    /// to any claim it can never be attached to another, even a rejected or
    /// patient-denied one. Real billing systems fix a rejected claim by
    /// resubmitting a corrected description/amount for the *same* line item,
    /// not by opening a second claim against the same service.
    mapping(uint256 => bool) public recordClaimed;

    event ClaimSubmitted(
        uint256 indexed id,
        address indexed patient,
        address indexed provider,
        address insurer,
        uint256 amount
    );
    event ClaimPatientApproved(uint256 indexed id, uint256 visibilityExpiresAt);
    event ClaimAutoApproved(uint256 indexed id, uint256 visibilityExpiresAt);
    event ClaimPatientDenied(uint256 indexed id);
    event ClaimApproved(uint256 indexed id);
    event ClaimRejected(uint256 indexed id);
    event VisibilityRenewalRequested(uint256 indexed id, address indexed requester);
    event VisibilityRenewed(uint256 indexed id, uint256 visibilityExpiresAt);

    constructor(address identityRegistryAddress, address medicalRecordRegistryAddress) {
        identityRegistry = IdentityRegistry(identityRegistryAddress);
        medicalRecordRegistry = MedicalRecordRegistry(medicalRecordRegistryAddress);
    }

    /// @notice A provider files a claim for services it rendered to a patient.
    /// @dev Every attached record must have been issued by the calling
    /// provider for this exact patient, OR (for a Prescription) actually
    /// dispensed by the calling pharmacy — the prescribing doctor is the
    /// record's issuer, but it's the dispensing pharmacy that rendered the
    /// billable service and should be the one able to claim for it. Either
    /// way, a provider can only claim for its own work, not attach someone
    /// else's record to inflate a claim. Also rejects any record already
    /// attached to an earlier claim, so batching many dispensed
    /// prescriptions into one monthly claim can't accidentally (or
    /// deliberately) double-bill the same service.
    function submitClaim(
        address patient,
        address insurer,
        uint256[] memory recordIds,
        string memory description,
        uint256 amount
    ) external returns (uint256) {
        IdentityRegistry.Role providerRole = identityRegistry.roleOf(msg.sender);
        require(
            providerRole == IdentityRegistry.Role.Hospital ||
            providerRole == IdentityRegistry.Role.Laboratory ||
            providerRole == IdentityRegistry.Role.Pharmacy,
            "Not an authorized provider"
        );
        require(identityRegistry.roleOf(patient) == IdentityRegistry.Role.Patient, "Not a patient");
        require(identityRegistry.roleOf(insurer) == IdentityRegistry.Role.Insurer, "Not an insurer");

        for (uint256 i = 0; i < recordIds.length; i++) {
            (, address recordPatient, address recordIssuer, , , , , ) = medicalRecordRegistry.records(recordIds[i]);
            require(recordPatient == patient, "Record does not belong to patient");
            bool isIssuer = recordIssuer == msg.sender;
            bool isDispensingPharmacy = medicalRecordRegistry.dispensedBy(recordIds[i]) == msg.sender;
            require(isIssuer || isDispensingPharmacy, "Not issued or dispensed by caller");
            require(!recordClaimed[recordIds[i]], "Record already claimed");
        }

        for (uint256 i = 0; i < recordIds.length; i++) {
            recordClaimed[recordIds[i]] = true;
        }

        // See the contract-level @notice: a Pharmacy claim skips straight to
        // Pending with its visibility window already open — every other
        // provider still needs the patient's explicit approval.
        bool skipsApproval = providerRole == IdentityRegistry.Role.Pharmacy;
        ClaimStatus initialStatus = skipsApproval ? ClaimStatus.Pending : ClaimStatus.AwaitingPatientApproval;
        uint256 initialVisibilityExpiresAt = skipsApproval ? block.timestamp + VISIBILITY_PERIOD : 0;

        uint256 id = claims.length;
        claims.push(Claim({
            id: id,
            patient: patient,
            provider: msg.sender,
            insurer: insurer,
            recordIds: recordIds,
            description: description,
            amount: amount,
            status: initialStatus,
            createdAt: block.timestamp,
            visibilityExpiresAt: initialVisibilityExpiresAt
        }));
        claimsOfPatient[patient].push(id);
        claimsOfProvider[msg.sender].push(id);
        claimsOfInsurer[insurer].push(id);

        emit ClaimSubmitted(id, patient, msg.sender, insurer, amount);
        if (skipsApproval) {
            emit ClaimAutoApproved(id, initialVisibilityExpiresAt);
        }
        return id;
    }

    /// @notice The patient allows the insurer to see and act on this claim,
    /// opening a VISIBILITY_PERIOD (30-day) window of full visibility.
    /// @dev This — not submitClaim — is the patient's real consent action,
    /// done in person right after the service (e.g. at the pharmacy counter).
    function approvePatientVisibility(uint256 claimId) external {
        Claim storage claim = claims[claimId];
        require(msg.sender == claim.patient, "Only the patient");
        require(claim.status == ClaimStatus.AwaitingPatientApproval, "Not awaiting approval");

        claim.status = ClaimStatus.Pending;
        claim.visibilityExpiresAt = block.timestamp + VISIBILITY_PERIOD;
        emit ClaimPatientApproved(claimId, claim.visibilityExpiresAt);
    }

    /// @notice The patient denies visibility — the insurer never sees this claim.
    function denyPatientVisibility(uint256 claimId) external {
        Claim storage claim = claims[claimId];
        require(msg.sender == claim.patient, "Only the patient");
        require(claim.status == ClaimStatus.AwaitingPatientApproval, "Not awaiting approval");

        claim.status = ClaimStatus.PatientDenied;
        emit ClaimPatientDenied(claimId);
    }

    /// @notice The insurer approves a claim the patient has already made visible.
    function approveClaim(uint256 claimId) external {
        Claim storage claim = claims[claimId];
        require(msg.sender == claim.insurer, "Only the claim's insurer");
        require(claim.status == ClaimStatus.Pending, "Not pending");

        claim.status = ClaimStatus.Approved;
        emit ClaimApproved(claimId);
    }

    /// @notice The insurer rejects a claim the patient has already made visible.
    function rejectClaim(uint256 claimId) external {
        Claim storage claim = claims[claimId];
        require(msg.sender == claim.insurer, "Only the claim's insurer");
        require(claim.status == ClaimStatus.Pending, "Not pending");

        claim.status = ClaimStatus.Rejected;
        emit ClaimRejected(claimId);
    }

    /// @notice Whether full claim detail (description, records, exact amount)
    /// should still be shown to the insurer — i.e. within the 30-day window
    /// since the patient's last approval/renewal. Once false, the frontend
    /// falls back to the non-sensitive stub described in this contract's
    /// top-level documentation.
    function hasFullVisibility(uint256 claimId) external view returns (bool) {
        return block.timestamp <= claims[claimId].visibilityExpiresAt;
    }

    /// @notice The claim's own provider or insurer asks the patient to renew
    /// full visibility after the 30-day window has lapsed.
    /// @dev Doesn't change any state itself — the patient's dashboard finds
    /// this via the event log (same event-log-then-recheck pattern used
    /// throughout this app) and decides whether it's still actionable by
    /// checking hasFullVisibility is still false.
    function requestVisibilityRenewal(uint256 claimId) external {
        Claim storage claim = claims[claimId];
        require(msg.sender == claim.provider || msg.sender == claim.insurer, "Not a party to this claim");
        require(block.timestamp > claim.visibilityExpiresAt, "Still visible");

        emit VisibilityRenewalRequested(claimId, msg.sender);
    }

    /// @notice The patient renews full visibility for another 30 days.
    function approveVisibilityRenewal(uint256 claimId) external {
        Claim storage claim = claims[claimId];
        require(msg.sender == claim.patient, "Only the patient");

        claim.visibilityExpiresAt = block.timestamp + VISIBILITY_PERIOD;
        emit VisibilityRenewed(claimId, claim.visibilityExpiresAt);
    }

    function getClaimsForPatient(address patient) external view returns (uint256[] memory) {
        return claimsOfPatient[patient];
    }

    function getClaimsForProvider(address provider) external view returns (uint256[] memory) {
        return claimsOfProvider[provider];
    }

    function getClaimsForInsurer(address insurer) external view returns (uint256[] memory) {
        return claimsOfInsurer[insurer];
    }

    /// @notice Returns the record ids attached to a claim.
    /// @dev Solidity's auto-generated getter for `claims(id)` omits the
    /// `recordIds` array member (public struct getters skip dynamic array
    /// fields), so this explicit getter is the only way to read it.
    function getClaimRecordIds(uint256 claimId) external view returns (uint256[] memory) {
        return claims[claimId].recordIds;
    }
}
