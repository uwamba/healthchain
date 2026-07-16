const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// ClaimRegistry.sol changed (recordClaimed double-claim guard, time-boxed
// visibilityExpiresAt/hasFullVisibility, requestVisibilityRenewal /
// approveVisibilityRenewal) — this deploys ONLY the new version, reusing the
// already-deployed IdentityRegistry and MedicalRecordRegistry rather than
// re-running the full deploy.js. Every other contract's address, and every
// already-registered account/record/visit/referral on this network, stays
// untouched. Any claims already filed under the OLD ClaimRegistry are lost —
// that's the one acceptable reset.
async function main() {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const outFile = path.join(deploymentsDir, `${hre.network.name}.json`);
  const existing = JSON.parse(fs.readFileSync(outFile, "utf8"));

  if (!existing.IdentityRegistry || !existing.MedicalRecordRegistry) {
    throw new Error(`Missing IdentityRegistry/MedicalRecordRegistry in ${outFile} — run scripts/deploy.js first.`);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Reusing IdentityRegistry at:", existing.IdentityRegistry);
  console.log("Reusing MedicalRecordRegistry at:", existing.MedicalRecordRegistry);

  const suggestedGasPrice = await hre.ethers.provider.getGasPrice();
  const overrides = { gasPrice: suggestedGasPrice.mul(3) };

  const ClaimRegistry = await hre.ethers.getContractFactory("ClaimRegistry");
  const claimRegistry = await ClaimRegistry.deploy(existing.IdentityRegistry, existing.MedicalRecordRegistry, overrides);
  await claimRegistry.deployed();
  console.log("New ClaimRegistry deployed to:", claimRegistry.address);

  existing.ClaimRegistry = claimRegistry.address;
  fs.writeFileSync(outFile, JSON.stringify(existing, null, 2));
  console.log("\nUpdated", outFile);

  console.log("\nUpdate this one line in healthcare-next/.env.local:\n");
  console.log(`NEXT_PUBLIC_CLAIM_REGISTRY_ADDRESS=${claimRegistry.address}`);
  console.log("\nWrote addresses to", outFile);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
