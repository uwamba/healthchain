// CIDs are stored on-chain bare (no ipfs:// prefix) for MedicalRecordRegistry,
// but MedicalRecordNFT's tokenURI does carry the prefix — strip it either way
// so this always resolves to a usable gateway URL.
export function resolveIpfsUrl(value) {
  if (!value) return null;
  const cid = value.replace(/^ipfs:\/\//i, "");
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

// Uploads a File through our own /api/upload proxy (server holds the Pinata
// JWT) and returns the bare CID, ready to pass into createRecord().
export async function uploadToIpfs(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", { method: "POST", body: formData });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Upload failed");
  }

  const { cid } = await response.json();
  return cid;
}
