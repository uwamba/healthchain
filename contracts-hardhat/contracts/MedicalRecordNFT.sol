// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MedicalRecordNFT
/// @notice ERC-721 representing a verified medical record owned by the patient it belongs to.
/// @dev Kept separate from MedicalRecordRegistry to avoid a circular constructor
/// dependency: this contract deploys first, then MedicalRecordRegistry deploys
/// with this contract's address, then setMinter() wires the two together.
/// Minting logic itself is intentionally trivial — all clinical business rules
/// (who may issue what, to whom) live in MedicalRecordRegistry, not here.
contract MedicalRecordNFT is ERC721URIStorage, Ownable {
    /// @notice The only address allowed to call mint() — set once to MedicalRecordRegistry's address.
    address public minter;

    uint256 private _nextTokenId;

    /// @notice Emitted on every mint, carrying the URI so indexers don't need a second tokenURI() call.
    event RecordMinted(uint256 indexed tokenId, address indexed to, string uri);

    modifier onlyMinter() {
        require(msg.sender == minter, "Only minter");
        _;
    }

    constructor() ERC721("HealthChain Medical Record", "HCMR") Ownable(msg.sender) {}

    /// @notice Wires this NFT contract to the registry allowed to mint against it.
    /// @dev Callable exactly once — locks in place after deployment wiring so no
    /// later owner action can silently redirect minting rights.
    /// @param minterAddress Address of the deployed MedicalRecordRegistry.
    function setMinter(address minterAddress) external onlyOwner {
        require(minter == address(0), "Minter already set");
        require(minterAddress != address(0), "Invalid minter");
        minter = minterAddress;
    }

    /// @notice Mints a new medical record NFT to a patient.
    /// @param to Patient address who will own the record.
    /// @param uri Token URI, expected to be an ipfs:// CID reference.
    /// @return tokenId The newly minted token's id.
    function mint(address to, string memory uri) external onlyMinter returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit RecordMinted(tokenId, to, uri);
        return tokenId;
    }
}
