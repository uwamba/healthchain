export const MEDICAL_RECORD_NFT_ADDRESS = process.env.NEXT_PUBLIC_MEDICAL_RECORD_NFT_ADDRESS;

export const MEDICAL_RECORD_NFT_ABI = [
  "function minter() view returns (address)",
  "function setMinter(address minterAddress)",
  "function mint(address to, string memory uri) returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event RecordMinted(uint256 indexed tokenId, address indexed to, string uri)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];
