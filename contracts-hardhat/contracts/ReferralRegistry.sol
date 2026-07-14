// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IdentityRegistry.sol";
import "./MedicalRecordRegistry.sol";

/// @title ReferralRegistry
/// @notice A doctor refers a patient to a laboratory, gated by the patient's
/// consent on both ends: sending the referral to the lab, and sending the
/// lab's result back to the referring doctor. Both approvals are explicit,
/// separately-signed patient transactions.
/// @dev Deliberately does NOT grant record-view access itself —
/// approveReferralResult is a consent/audit record ("the patient explicitly
/// authorized sharing this specific result with this specific doctor"), not
/// a visibility mechanism. The referring doctor still only sees the new
/// record through the existing, unmodified AccessControlRegistry grant.
/// Keeping access control in exactly one place avoids two overlapping trust
/// systems that could quietly disagree with each other.
contract ReferralRegistry {
    IdentityRegistry public immutable identityRegistry;
    MedicalRecordRegistry public immutable medicalRecordRegistry;

    enum ReferralStatus { Requested, Approved, Denied, Completed, ResultApproved }

    struct Referral {
        uint256 id;
        address patient;
        address referringDoctor;
        address provider;
        string reason;
        ReferralStatus status;
        uint256 resultRecordId;
        uint256 createdAt;
    }

    Referral[] public referrals;
    mapping(address => uint256[]) public referralsOfPatient;

    // `patient` isn't indexed here — patient-side lookups already have an
    // on-chain array (referralsOfPatient) and don't need event filtering.
    // `referringDoctor` is indexed instead so the Doctor dashboard can find
    // its own referrals the same event-log-then-recheck way Laboratory
    // finds its own via `provider`.
    event ReferralRequested(uint256 indexed id, address indexed referringDoctor, address indexed provider, address patient);
    event ReferralApproved(uint256 indexed id);
    event ReferralDenied(uint256 indexed id);
    event ReferralCompleted(uint256 indexed id, uint256 recordId);
    event ReferralResultApproved(uint256 indexed id);

    constructor(address identityRegistryAddress, address medicalRecordRegistryAddress) {
        identityRegistry = IdentityRegistry(identityRegistryAddress);
        medicalRecordRegistry = MedicalRecordRegistry(medicalRecordRegistryAddress);
    }

    /// @notice A doctor refers a patient to a laboratory for a test.
    function createReferral(address patient, address provider, string memory reason) external returns (uint256) {
        require(identityRegistry.roleOf(msg.sender) == IdentityRegistry.Role.Doctor, "Only doctors");
        require(identityRegistry.roleOf(provider) == IdentityRegistry.Role.Laboratory, "Not a laboratory");
        require(identityRegistry.roleOf(patient) == IdentityRegistry.Role.Patient, "Not a patient");

        uint256 id = referrals.length;
        referrals.push(Referral({
            id: id,
            patient: patient,
            referringDoctor: msg.sender,
            provider: provider,
            reason: reason,
            status: ReferralStatus.Requested,
            resultRecordId: 0,
            createdAt: block.timestamp
        }));
        referralsOfPatient[patient].push(id);

        emit ReferralRequested(id, msg.sender, provider, patient);
        return id;
    }

    /// @notice The patient consents to being referred to the lab.
    function approveReferral(uint256 referralId) external {
        Referral storage referral = referrals[referralId];
        require(msg.sender == referral.patient, "Only this referral's patient");
        require(referral.status == ReferralStatus.Requested, "Not awaiting approval");

        referral.status = ReferralStatus.Approved;
        emit ReferralApproved(referralId);
    }

    /// @notice The patient declines the referral.
    function denyReferral(uint256 referralId) external {
        Referral storage referral = referrals[referralId];
        require(msg.sender == referral.patient, "Only this referral's patient");
        require(referral.status == ReferralStatus.Requested, "Not awaiting approval");

        referral.status = ReferralStatus.Denied;
        emit ReferralDenied(referralId);
    }

    /// @notice The lab ties its finished result record to this referral.
    /// @dev The record must already exist (created via the normal
    /// MedicalRecordRegistry.createRecord flow) and must have been issued
    /// by this same lab for this same patient.
    function completeReferral(uint256 referralId, uint256 recordId) external {
        Referral storage referral = referrals[referralId];
        require(msg.sender == referral.provider, "Only this referral's provider");
        require(referral.status == ReferralStatus.Approved, "Not approved");

        (, address recordPatient, address recordIssuer, , , , , ) = medicalRecordRegistry.records(recordId);
        require(recordPatient == referral.patient, "Record does not belong to referral's patient");
        require(recordIssuer == msg.sender, "Record not issued by this provider");

        referral.status = ReferralStatus.Completed;
        referral.resultRecordId = recordId;
        emit ReferralCompleted(referralId, recordId);
    }

    /// @notice The patient consents to sharing the completed result back with the referring doctor.
    function approveReferralResult(uint256 referralId) external {
        Referral storage referral = referrals[referralId];
        require(msg.sender == referral.patient, "Only this referral's patient");
        require(referral.status == ReferralStatus.Completed, "Not yet completed");

        referral.status = ReferralStatus.ResultApproved;
        emit ReferralResultApproved(referralId);
    }

    function getReferralsOfPatient(address patient) external view returns (uint256[] memory) {
        return referralsOfPatient[patient];
    }
}
