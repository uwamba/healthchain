// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IdentityRegistry.sol";

/// @title AccessControlRegistry
/// @notice Fine-grained, time-boxed permission grants between a patient and a
/// doctor or pharmacy: the provider must request access, and only the patient
/// can approve it for a fixed duration, deny it, or revoke it early.
/// @dev Composes with IdentityRegistry the same way AppointmentRegistry does —
/// an immutable reference, roles resolved via roleOf(), no separate role store.
/// This is the resource-level RBAC layer; coarse role gating (e.g. "only
/// Doctors/Pharmacies may call requestAccess") still lives on top of
/// IdentityRegistry roles. Doctor access is used by the frontend to gate a
/// patient's full record timeline; the same grant, requested by a Pharmacy,
/// is used to gate visibility into that patient's Prescription-type records
/// only — that scoping is a frontend policy choice (see docs/SECURITY.md),
/// not a distinction this contract itself encodes.
contract AccessControlRegistry {
    IdentityRegistry public immutable identityRegistry;

    enum Duration { OneDay, OneWeek, OneMonth }
    enum Status { None, Pending, Approved, Denied, Revoked }

    struct Grant {
        Status status;
        uint256 expiresAt;
        uint256 requestedAt;
    }

    /// @dev patient => doctor => Grant.
    mapping(address => mapping(address => Grant)) public grants;

    event AccessRequested(address indexed patient, address indexed doctor);
    event AccessApproved(address indexed patient, address indexed doctor, uint256 expiresAt);
    event AccessDenied(address indexed patient, address indexed doctor);
    event AccessRevoked(address indexed patient, address indexed doctor);

    constructor(address identityRegistryAddress) {
        identityRegistry = IdentityRegistry(identityRegistryAddress);
    }

    function _durationToSeconds(Duration duration) private pure returns (uint256) {
        if (duration == Duration.OneDay) return 1 days;
        if (duration == Duration.OneWeek) return 7 days;
        return 30 days;
    }

    /// @notice A doctor or pharmacy requests access to a patient's records.
    /// @dev Reverts if an unexpired approved grant already exists, so a
    /// provider can't spam re-requests to reset a grant they already hold.
    function requestAccess(address patient) external {
        IdentityRegistry.Role callerRole = identityRegistry.roleOf(msg.sender);
        require(
            callerRole == IdentityRegistry.Role.Doctor || callerRole == IdentityRegistry.Role.Pharmacy,
            "Only doctors or pharmacies"
        );
        require(identityRegistry.roleOf(patient) == IdentityRegistry.Role.Patient, "Not a patient");

        Grant storage grant = grants[patient][msg.sender];
        bool activelyApproved = grant.status == Status.Approved && block.timestamp <= grant.expiresAt;
        require(!activelyApproved, "Access already granted");

        grants[patient][msg.sender] = Grant({
            status: Status.Pending,
            expiresAt: 0,
            requestedAt: block.timestamp
        });
        emit AccessRequested(patient, msg.sender);
    }

    /// @notice The patient approves a pending request for a fixed duration.
    /// @param doctor Address of the requesting doctor.
    /// @param duration One of the three fixed durations offered in the UI.
    function approveAccess(address doctor, Duration duration) external {
        Grant storage grant = grants[msg.sender][doctor];
        require(grant.status == Status.Pending, "No pending request");

        grant.status = Status.Approved;
        grant.expiresAt = block.timestamp + _durationToSeconds(duration);
        emit AccessApproved(msg.sender, doctor, grant.expiresAt);
    }

    /// @notice The patient denies a pending request.
    function denyAccess(address doctor) external {
        Grant storage grant = grants[msg.sender][doctor];
        require(grant.status == Status.Pending, "No pending request");

        grant.status = Status.Denied;
        emit AccessDenied(msg.sender, doctor);
    }

    /// @notice The patient revokes a previously approved grant before it expires.
    function revokeAccess(address doctor) external {
        Grant storage grant = grants[msg.sender][doctor];
        require(grant.status == Status.Approved, "No active grant");

        grant.status = Status.Revoked;
        emit AccessRevoked(msg.sender, doctor);
    }

    /// @notice Whether a provider currently has unexpired approved access to a patient.
    /// @dev The single check every provider-facing read path must call before
    /// fetching or displaying that patient's records.
    function hasAccess(address patient, address doctor) external view returns (bool) {
        Grant storage grant = grants[patient][doctor];
        return grant.status == Status.Approved && block.timestamp <= grant.expiresAt;
    }
}
