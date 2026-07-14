// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IdentityRegistry.sol";

/// @title VisitRegistry
/// @notice Models a physical hospital visit: the hospital front-desk opens a
/// check-in request for a patient who has walked in, the patient confirms it
/// (in practice, by scanning a QR that deep-links to this exact request on
/// their own phone and signing the approval themselves), and the hospital
/// may dispatch the visit to a specific doctor.
/// @dev Layered on top of — not a replacement for — the one-time identity
/// registration in IdentityRegistry; a patient must already be registered
/// before any hospital can open a visit for them. assignDoctor is a dispatch
/// hint only: it does not grant the doctor record access by itself — the
/// doctor still goes through AccessControlRegistry's own request/approve
/// flow, unchanged, so a compromised Hospital account can never grant
/// access to a patient's records without the patient's own signature.
contract VisitRegistry {
    IdentityRegistry public immutable identityRegistry;

    enum VisitStatus { Requested, CheckedIn, Cancelled }

    struct Visit {
        uint256 id;
        address patient;
        address hospital;
        address assignedDoctor;
        VisitStatus status;
        uint256 requestedAt;
        uint256 checkedInAt;
    }

    Visit[] public visits;
    mapping(address => uint256[]) public visitsOfPatient;

    event VisitRequested(uint256 indexed id, address indexed patient, address indexed hospital);
    event VisitDoctorAssigned(uint256 indexed id, address indexed doctor);
    event VisitApproved(uint256 indexed id);
    event VisitCancelled(uint256 indexed id);

    constructor(address identityRegistryAddress) {
        identityRegistry = IdentityRegistry(identityRegistryAddress);
    }

    /// @notice A hospital opens a check-in request for a patient who has walked in.
    /// @dev The returned id is what the front-desk QR encodes.
    function requestVisit(address patient) external returns (uint256) {
        require(identityRegistry.roleOf(msg.sender) == IdentityRegistry.Role.Hospital, "Only hospitals");
        require(identityRegistry.roleOf(patient) == IdentityRegistry.Role.Patient, "Not a patient");

        uint256 id = visits.length;
        visits.push(Visit({
            id: id,
            patient: patient,
            hospital: msg.sender,
            assignedDoctor: address(0),
            status: VisitStatus.Requested,
            requestedAt: block.timestamp,
            checkedInAt: 0
        }));
        visitsOfPatient[patient].push(id);

        emit VisitRequested(id, patient, msg.sender);
        return id;
    }

    /// @notice The hospital dispatches a checked-in (or still-pending) visit to a doctor.
    /// @dev Dispatch hint only — see contract-level note on why this doesn't
    /// grant record access by itself.
    function assignDoctor(uint256 visitId, address doctor) external {
        Visit storage visit = visits[visitId];
        require(msg.sender == visit.hospital, "Only this visit's hospital");
        require(identityRegistry.roleOf(doctor) == IdentityRegistry.Role.Doctor, "Not a doctor");
        require(visit.status != VisitStatus.Cancelled, "Visit cancelled");

        visit.assignedDoctor = doctor;
        emit VisitDoctorAssigned(visitId, doctor);
    }

    /// @notice The patient confirms their check-in.
    /// @dev This is the transaction the patient's own wallet signs — whether
    /// triggered by scanning the front-desk QR or just tapping Approve in
    /// their own dashboard if they already have it open.
    function approveVisit(uint256 visitId) external {
        Visit storage visit = visits[visitId];
        require(msg.sender == visit.patient, "Only this visit's patient");
        require(visit.status == VisitStatus.Requested, "Not awaiting approval");

        visit.status = VisitStatus.CheckedIn;
        visit.checkedInAt = block.timestamp;
        emit VisitApproved(visitId);
    }

    /// @notice Either the patient or the hospital can cancel a visit before check-in.
    function cancelVisit(uint256 visitId) external {
        Visit storage visit = visits[visitId];
        require(msg.sender == visit.patient || msg.sender == visit.hospital, "Not authorized");
        require(visit.status == VisitStatus.Requested, "Already resolved");

        visit.status = VisitStatus.Cancelled;
        emit VisitCancelled(visitId);
    }

    function getVisitsOfPatient(address patient) external view returns (uint256[] memory) {
        return visitsOfPatient[patient];
    }
}
