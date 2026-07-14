const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// Deploys contracts in dependency order and wires each one's constructor
// args to the addresses deployed just before it — the whole point of using
// Hardhat here instead of pasting into Remix one at a time, since these
// contracts reference each other's addresses.
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.deployed();
  console.log("IdentityRegistry deployed to:", identityRegistry.address);

  const AppointmentRegistry = await hre.ethers.getContractFactory("AppointmentRegistry");
  const appointmentRegistry = await AppointmentRegistry.deploy(identityRegistry.address);
  await appointmentRegistry.deployed();
  console.log("AppointmentRegistry deployed to:", appointmentRegistry.address);

  const MedicalRecordNFT = await hre.ethers.getContractFactory("MedicalRecordNFT");
  const medicalRecordNFT = await MedicalRecordNFT.deploy();
  await medicalRecordNFT.deployed();
  console.log("MedicalRecordNFT deployed to:", medicalRecordNFT.address);

  const MedicalRecordRegistry = await hre.ethers.getContractFactory("MedicalRecordRegistry");
  const medicalRecordRegistry = await MedicalRecordRegistry.deploy(
    identityRegistry.address,
    medicalRecordNFT.address
  );
  await medicalRecordRegistry.deployed();
  console.log("MedicalRecordRegistry deployed to:", medicalRecordRegistry.address);

  // Locks MedicalRecordNFT's mint() to only be callable by the registry —
  // must happen after both are deployed, before either is used for real.
  await (await medicalRecordNFT.setMinter(medicalRecordRegistry.address)).wait();
  console.log("MedicalRecordNFT minter set to MedicalRecordRegistry");

  const AccessControlRegistry = await hre.ethers.getContractFactory("AccessControlRegistry");
  const accessControlRegistry = await AccessControlRegistry.deploy(identityRegistry.address);
  await accessControlRegistry.deployed();
  console.log("AccessControlRegistry deployed to:", accessControlRegistry.address);

  const ClaimRegistry = await hre.ethers.getContractFactory("ClaimRegistry");
  const claimRegistry = await ClaimRegistry.deploy(identityRegistry.address, medicalRecordRegistry.address);
  await claimRegistry.deployed();
  console.log("ClaimRegistry deployed to:", claimRegistry.address);

  const VisitRegistry = await hre.ethers.getContractFactory("VisitRegistry");
  const visitRegistry = await VisitRegistry.deploy(identityRegistry.address);
  await visitRegistry.deployed();
  console.log("VisitRegistry deployed to:", visitRegistry.address);

  const ReferralRegistry = await hre.ethers.getContractFactory("ReferralRegistry");
  const referralRegistry = await ReferralRegistry.deploy(identityRegistry.address, medicalRecordRegistry.address);
  await referralRegistry.deployed();
  console.log("ReferralRegistry deployed to:", referralRegistry.address);

  const addresses = {
    network: hre.network.name,
    IdentityRegistry: identityRegistry.address,
    AppointmentRegistry: appointmentRegistry.address,
    MedicalRecordNFT: medicalRecordNFT.address,
    MedicalRecordRegistry: medicalRecordRegistry.address,
    AccessControlRegistry: accessControlRegistry.address,
    ClaimRegistry: claimRegistry.address,
    VisitRegistry: visitRegistry.address,
    ReferralRegistry: referralRegistry.address,
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outFile = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(addresses, null, 2));
  console.log("\nWrote addresses to", outFile);

  console.log("\nPaste into healthcare-next/.env.local:\n");
  console.log(`NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=${identityRegistry.address}`);
  console.log(`NEXT_PUBLIC_APPOINTMENT_REGISTRY_ADDRESS=${appointmentRegistry.address}`);
  console.log(`NEXT_PUBLIC_MEDICAL_RECORD_NFT_ADDRESS=${medicalRecordNFT.address}`);
  console.log(`NEXT_PUBLIC_MEDICAL_RECORD_REGISTRY_ADDRESS=${medicalRecordRegistry.address}`);
  console.log(`NEXT_PUBLIC_ACCESS_CONTROL_REGISTRY_ADDRESS=${accessControlRegistry.address}`);
  console.log(`NEXT_PUBLIC_CLAIM_REGISTRY_ADDRESS=${claimRegistry.address}`);
  console.log(`NEXT_PUBLIC_VISIT_REGISTRY_ADDRESS=${visitRegistry.address}`);
  console.log(`NEXT_PUBLIC_REFERRAL_REGISTRY_ADDRESS=${referralRegistry.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
