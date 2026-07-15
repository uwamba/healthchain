const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// Redeploys exactly the 5 contracts affected by two bug fixes:
//   - AppointmentRegistry: new Requested/Confirmed/Declined status flow
//   - MedicalRecordNFT + MedicalRecordRegistry: new dispensedBy tracking
//     (MedicalRecordNFT needs a fresh instance too since its minter can only
//     ever be set once, and it must point at the new MedicalRecordRegistry)
//   - ClaimRegistry + ReferralRegistry: depend on MedicalRecordRegistry's
//     address, so they need fresh instances wired to the new one
// IdentityRegistry, AccessControlRegistry, and VisitRegistry are untouched —
// reused as-is from the existing deployment, so every registered account,
// access grant, and hospital visit survives this redeploy. Only records,
// prescriptions, claims, and referrals reset.
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

  const suggestedGasPrice = await hre.ethers.provider.getGasPrice();
  const overrides = { gasPrice: suggestedGasPrice.mul(3) };

  const AppointmentRegistry = await hre.ethers.getContractFactory("AppointmentRegistry");
  const appointmentRegistry = await AppointmentRegistry.deploy(existing.IdentityRegistry, overrides);
  await appointmentRegistry.deployed();
  console.log("New AppointmentRegistry deployed to:", appointmentRegistry.address);

  const MedicalRecordNFT = await hre.ethers.getContractFactory("MedicalRecordNFT");
  const medicalRecordNFT = await MedicalRecordNFT.deploy(overrides);
  await medicalRecordNFT.deployed();
  console.log("New MedicalRecordNFT deployed to:", medicalRecordNFT.address);

  const MedicalRecordRegistry = await hre.ethers.getContractFactory("MedicalRecordRegistry");
  const medicalRecordRegistry = await MedicalRecordRegistry.deploy(
    existing.IdentityRegistry,
    medicalRecordNFT.address,
    overrides
  );
  await medicalRecordRegistry.deployed();
  console.log("New MedicalRecordRegistry deployed to:", medicalRecordRegistry.address);

  await (await medicalRecordNFT.setMinter(medicalRecordRegistry.address, overrides)).wait();
  console.log("MedicalRecordNFT minter set to new MedicalRecordRegistry");

  const ClaimRegistry = await hre.ethers.getContractFactory("ClaimRegistry");
  const claimRegistry = await ClaimRegistry.deploy(
    existing.IdentityRegistry,
    medicalRecordRegistry.address,
    overrides
  );
  await claimRegistry.deployed();
  console.log("New ClaimRegistry deployed to:", claimRegistry.address);

  const ReferralRegistry = await hre.ethers.getContractFactory("ReferralRegistry");
  const referralRegistry = await ReferralRegistry.deploy(
    existing.IdentityRegistry,
    medicalRecordRegistry.address,
    overrides
  );
  await referralRegistry.deployed();
  console.log("New ReferralRegistry deployed to:", referralRegistry.address);

  existing.AppointmentRegistry = appointmentRegistry.address;
  existing.MedicalRecordNFT = medicalRecordNFT.address;
  existing.MedicalRecordRegistry = medicalRecordRegistry.address;
  existing.ClaimRegistry = claimRegistry.address;
  existing.ReferralRegistry = referralRegistry.address;
  fs.writeFileSync(outFile, JSON.stringify(existing, null, 2));
  console.log("\nUpdated", outFile);

  console.log("\nUpdate these lines in healthcare-next/.env.local:\n");
  console.log(`NEXT_PUBLIC_APPOINTMENT_REGISTRY_ADDRESS=${appointmentRegistry.address}`);
  console.log(`NEXT_PUBLIC_MEDICAL_RECORD_NFT_ADDRESS=${medicalRecordNFT.address}`);
  console.log(`NEXT_PUBLIC_MEDICAL_RECORD_REGISTRY_ADDRESS=${medicalRecordRegistry.address}`);
  console.log(`NEXT_PUBLIC_CLAIM_REGISTRY_ADDRESS=${claimRegistry.address}`);
  console.log(`NEXT_PUBLIC_REFERRAL_REGISTRY_ADDRESS=${referralRegistry.address}`);
  console.log("\nWrote addresses to", outFile);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
