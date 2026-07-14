const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// AccessControlRegistry.sol changed (requestAccess now also accepts a
// Pharmacy caller, not just Doctor) — this deploys ONLY the new version,
// reusing the already-deployed IdentityRegistry rather than re-running the
// full deploy.js. That keeps every other contract's address, and every
// already-registered account/record/visit/referral/claim on this network,
// completely untouched. Any access grants already requested/approved under
// the OLD AccessControlRegistry are lost — that's the one acceptable reset.
async function main() {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const outFile = path.join(deploymentsDir, `${hre.network.name}.json`);
  const existing = JSON.parse(fs.readFileSync(outFile, "utf8"));

  if (!existing.IdentityRegistry) {
    throw new Error(`No IdentityRegistry address found in ${outFile} — run scripts/deploy.js first.`);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Reusing IdentityRegistry at:", existing.IdentityRegistry);

  const AccessControlRegistry = await hre.ethers.getContractFactory("AccessControlRegistry");
  const accessControlRegistry = await AccessControlRegistry.deploy(existing.IdentityRegistry);
  await accessControlRegistry.deployed();
  console.log("New AccessControlRegistry deployed to:", accessControlRegistry.address);

  existing.AccessControlRegistry = accessControlRegistry.address;
  fs.writeFileSync(outFile, JSON.stringify(existing, null, 2));
  console.log("\nUpdated", outFile);

  console.log("\nUpdate this one line in healthcare-next/.env.local:\n");
  console.log(`NEXT_PUBLIC_ACCESS_CONTROL_REGISTRY_ADDRESS=${accessControlRegistry.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
