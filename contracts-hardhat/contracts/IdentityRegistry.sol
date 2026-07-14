// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IdentityRegistry
/// @notice Single source of truth for "who is this address and what role do
/// they hold". Every other contract in this system resolves roles by calling
/// back into this one, rather than keeping its own separate role store, so a
/// role can never drift between contracts.
contract IdentityRegistry {

    enum Role { None, Patient, Doctor, Hospital, Laboratory, Pharmacy, Insurer }

    struct Profile {
        Role role;
        string name;
        string organization; // hospital/lab/pharmacy/insurer name; unused for patients
        bytes32 publicKey;   // Curve25519 public key for record encryption (set later, see setPublicKey)
        address hospital;    // doctor's confirmed hospital affiliation, address(0) if none
        bool registered;
    }

    mapping(address => Profile) public profiles;

    event Registered(address indexed account, Role role, string name);
    event PublicKeySet(address indexed account, bytes32 publicKey);
    event HospitalAffiliationRequested(address indexed doctor, address indexed hospital);
    event HospitalAffiliationConfirmed(address indexed doctor, address indexed hospital);

    /// @notice Registers the caller under a role, once.
    /// @param role Any role other than None.
    /// @param name Display name.
    /// @param organization Hospital/lab/pharmacy/insurer name; unused for patients.
    function register(
        Role role,
        string memory name,
        string memory organization
    ) external {
        require(role != Role.None, "Invalid role");
        require(!profiles[msg.sender].registered, "Already registered");

        profiles[msg.sender] = Profile({
            role: role,
            name: name,
            organization: organization,
            publicKey: bytes32(0),
            hospital: address(0),
            registered: true
        });

        emit Registered(msg.sender, role, name);
    }

    // Set separately from registration since the encryption keypair (Phase 2)
    // is generated client-side after the wallet is already connected and
    // registered — registration itself shouldn't have to wait on that.
    /// @notice Sets the caller's Curve25519 public key, used for record-sharing encryption.
    function setPublicKey(bytes32 publicKey) external {
        require(profiles[msg.sender].registered, "Not registered");
        profiles[msg.sender].publicKey = publicKey;
        emit PublicKeySet(msg.sender, publicKey);
    }

    /// @notice Returns an account's registered role (None if never registered).
    function roleOf(address account) external view returns (Role) {
        return profiles[account].role;
    }

    /// @notice Returns whether an account has registered.
    function isRegistered(address account) external view returns (bool) {
        return profiles[account].registered;
    }

    /// @notice Returns an account's stored Curve25519 public key (zero if never set).
    function publicKeyOf(address account) external view returns (bytes32) {
        return profiles[account].publicKey;
    }

    /// @notice A doctor proposes affiliation with a hospital.
    /// @dev The hospital must separately call confirmHospitalAffiliation —
    /// a doctor can't unilaterally claim to belong to a hospital.
    function requestHospitalAffiliation(address hospital) external {
        require(profiles[msg.sender].role == Role.Doctor, "Only doctors");
        require(profiles[hospital].role == Role.Hospital, "Not a hospital");
        emit HospitalAffiliationRequested(msg.sender, hospital);
    }

    /// @notice A hospital confirms a doctor's proposed affiliation.
    function confirmHospitalAffiliation(address doctor) external {
        require(profiles[msg.sender].role == Role.Hospital, "Only hospitals");
        require(profiles[doctor].role == Role.Doctor, "Not a doctor");
        profiles[doctor].hospital = msg.sender;
        emit HospitalAffiliationConfirmed(doctor, msg.sender);
    }
}
