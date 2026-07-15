// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IdentityRegistry.sol";
import "./MedicalRecordNFT.sol";

/// @title MedicalRecordRegistry
/// @notice Core clinical-data contract: creates medical records, mints a
/// MedicalRecordNFT for each one, and tracks prescription dispensing / revocation.
/// @dev Resolves roles by calling back into IdentityRegistry rather than keeping
/// a separate role store, mirroring the pattern established by AppointmentRegistry.
contract MedicalRecordRegistry {
    IdentityRegistry public immutable identityRegistry;
    MedicalRecordNFT public immutable medicalRecordNFT;

    enum RecordType { Consultation, LabResult, Prescription, Imaging, Discharge, Vaccination }
    enum RecordStatus { Active, Dispensed, Revoked }

    struct MedicalRecord {
        uint256 id;
        address patient;
        address issuer;
        RecordType recordType;
        string ipfsCid;
        RecordStatus status;
        uint256 createdAt;
        uint256 tokenId;
    }

    MedicalRecord[] public records;

    /// @dev Kept alongside the array (rather than derived off-chain) so the
    /// Patient dashboard can read a full record list in a single call.
    mapping(address => uint256[]) public recordsOfPatient;

    /// @dev Set in dispensePrescription — lets ClaimRegistry recognize the
    /// dispensing pharmacy as entitled to claim for a prescription it
    /// dispensed but didn't issue (the issuer is the prescribing doctor).
    mapping(uint256 => address) public dispensedBy;

    event RecordCreated(
        uint256 indexed id,
        address indexed patient,
        address indexed issuer,
        RecordType recordType,
        string ipfsCid,
        uint256 tokenId
    );
    event PrescriptionDispensed(uint256 indexed recordId, address indexed pharmacy);
    event RecordRevoked(uint256 indexed recordId);

    constructor(address identityRegistryAddress, address medicalRecordNFTAddress) {
        identityRegistry = IdentityRegistry(identityRegistryAddress);
        medicalRecordNFT = MedicalRecordNFT(medicalRecordNFTAddress);
    }

    /// @notice Creates a medical record for a patient and mints the corresponding NFT.
    /// @dev Caller must be a registered issuer role (Doctor/Hospital/Laboratory/Pharmacy) —
    /// Patient and Insurer are deliberately excluded from issuing records about anyone.
    /// @param patient Address of the patient the record belongs to.
    /// @param recordType Category of the record.
    /// @param ipfsCid IPFS CID of the (already uploaded) record document.
    /// @return id The newly created record's id.
    function createRecord(
        address patient,
        RecordType recordType,
        string memory ipfsCid
    ) external returns (uint256) {
        IdentityRegistry.Role issuerRole = identityRegistry.roleOf(msg.sender);
        require(
            issuerRole == IdentityRegistry.Role.Doctor ||
            issuerRole == IdentityRegistry.Role.Hospital ||
            issuerRole == IdentityRegistry.Role.Laboratory ||
            issuerRole == IdentityRegistry.Role.Pharmacy,
            "Not an authorized issuer"
        );
        require(identityRegistry.roleOf(patient) == IdentityRegistry.Role.Patient, "Not a patient");

        uint256 tokenId = medicalRecordNFT.mint(patient, string.concat("ipfs://", ipfsCid));

        uint256 id = records.length;
        records.push(MedicalRecord({
            id: id,
            patient: patient,
            issuer: msg.sender,
            recordType: recordType,
            ipfsCid: ipfsCid,
            status: RecordStatus.Active,
            createdAt: block.timestamp,
            tokenId: tokenId
        }));
        recordsOfPatient[patient].push(id);

        emit RecordCreated(id, patient, msg.sender, recordType, ipfsCid, tokenId);
        return id;
    }

    /// @notice Marks a Prescription-type record as dispensed.
    /// @dev This is the on-chain half of the pharmacy QR-verification flow —
    /// no separate prescription contract is needed since the state transition
    /// is a single field flip gated by role + record type + current status.
    function dispensePrescription(uint256 recordId) external {
        require(identityRegistry.roleOf(msg.sender) == IdentityRegistry.Role.Pharmacy, "Only pharmacies");
        MedicalRecord storage record = records[recordId];
        require(record.recordType == RecordType.Prescription, "Not a prescription");
        require(record.status == RecordStatus.Active, "Not active");

        record.status = RecordStatus.Dispensed;
        dispensedBy[recordId] = msg.sender;
        emit PrescriptionDispensed(recordId, msg.sender);
    }

    /// @notice Revokes a record, e.g. to correct an erroneous entry.
    /// @dev Callable by the issuer or the patient themselves — not by an
    /// unrelated third party, even one holding another clinical role.
    function revokeRecord(uint256 recordId) external {
        MedicalRecord storage record = records[recordId];
        require(msg.sender == record.issuer || msg.sender == record.patient, "Not authorized");
        require(record.status != RecordStatus.Revoked, "Already revoked");

        record.status = RecordStatus.Revoked;
        emit RecordRevoked(recordId);
    }

    /// @notice Returns all record ids belonging to a patient.
    function getRecordsOfPatient(address patient) external view returns (uint256[] memory) {
        return recordsOfPatient[patient];
    }
}
