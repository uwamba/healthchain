const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClaimRegistry", function () {
  let identityRegistry, nft, medicalRecordRegistry, claimRegistry;
  let patient, otherPatient, pharmacy, otherPharmacy, insurer, doctor;

  const Role = { None: 0, Patient: 1, Doctor: 2, Hospital: 3, Laboratory: 4, Pharmacy: 5, Insurer: 6 };
  const RecordType = { Consultation: 0, LabResult: 1, Prescription: 2, Imaging: 3, Discharge: 4, Vaccination: 5 };
  const ClaimStatus = { AwaitingPatientApproval: 0, Pending: 1, Approved: 2, Rejected: 3, PatientDenied: 4 };

  beforeEach(async function () {
    [patient, otherPatient, pharmacy, otherPharmacy, insurer, doctor] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.deployed();

    const MedicalRecordNFT = await ethers.getContractFactory("MedicalRecordNFT");
    nft = await MedicalRecordNFT.deploy();
    await nft.deployed();

    const MedicalRecordRegistry = await ethers.getContractFactory("MedicalRecordRegistry");
    medicalRecordRegistry = await MedicalRecordRegistry.deploy(identityRegistry.address, nft.address);
    await medicalRecordRegistry.deployed();
    await nft.setMinter(medicalRecordRegistry.address);

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    claimRegistry = await ClaimRegistry.deploy(identityRegistry.address, medicalRecordRegistry.address);
    await claimRegistry.deployed();

    await identityRegistry.connect(patient).register(Role.Patient, "Alice", "");
    await identityRegistry.connect(otherPatient).register(Role.Patient, "Bob", "");
    await identityRegistry.connect(pharmacy).register(Role.Pharmacy, "Central Pharmacy", "Central Pharmacy");
    await identityRegistry.connect(otherPharmacy).register(Role.Pharmacy, "Other Pharmacy", "Other Pharmacy");
    await identityRegistry.connect(insurer).register(Role.Insurer, "Acme Insurance", "Acme Insurance");
    await identityRegistry.connect(doctor).register(Role.Doctor, "Dr. Smith", "");

    await medicalRecordRegistry.connect(pharmacy).createRecord(patient.address, RecordType.Prescription, "cid-rx");
  });

  it("walks the full happy path: submit -> patient approves visibility -> insurer approves", async function () {
    await expect(claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "Dispensed medication", 5000))
      .to.emit(claimRegistry, "ClaimSubmitted")
      .withArgs(0, patient.address, pharmacy.address, insurer.address, 5000);

    let claim = await claimRegistry.claims(0);
    expect(claim.status).to.equal(ClaimStatus.AwaitingPatientApproval);
    expect(await claimRegistry.hasFullVisibility(0)).to.equal(false);

    const tx = await claimRegistry.connect(patient).approvePatientVisibility(0);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const expectedExpiry = block.timestamp + 30 * 24 * 60 * 60;

    await expect(tx).to.emit(claimRegistry, "ClaimPatientApproved").withArgs(0, expectedExpiry);
    expect(await claimRegistry.hasFullVisibility(0)).to.equal(true);

    await expect(claimRegistry.connect(insurer).approveClaim(0))
      .to.emit(claimRegistry, "ClaimApproved")
      .withArgs(0);

    claim = await claimRegistry.claims(0);
    expect(claim.status).to.equal(ClaimStatus.Approved);
  });

  it("submits one claim bundling multiple records for the same patient", async function () {
    await medicalRecordRegistry.connect(pharmacy).createRecord(patient.address, RecordType.Prescription, "cid-rx-2");

    await claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0, 1], "Two prescriptions", 9000);
    const recordIds = await claimRegistry.getClaimRecordIds(0);
    expect(recordIds.map((n) => n.toNumber())).to.deep.equal([0, 1]);
  });

  it("rejects attaching a record that was already claimed", async function () {
    await claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "x", 100);

    await expect(
      claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "y", 200)
    ).to.be.revertedWith("Record already claimed");
  });

  it("expires full visibility after 30 days and lets the patient renew it", async function () {
    await claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "x", 100);
    await claimRegistry.connect(patient).approvePatientVisibility(0);
    expect(await claimRegistry.hasFullVisibility(0)).to.equal(true);

    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");
    expect(await claimRegistry.hasFullVisibility(0)).to.equal(false);

    await expect(claimRegistry.connect(patient).requestVisibilityRenewal(0)).to.be.revertedWith(
      "Not a party to this claim"
    );

    await expect(claimRegistry.connect(insurer).requestVisibilityRenewal(0))
      .to.emit(claimRegistry, "VisibilityRenewalRequested")
      .withArgs(0, insurer.address);

    await expect(claimRegistry.connect(doctor).approveVisibilityRenewal(0)).to.be.revertedWith("Only the patient");

    const tx = await claimRegistry.connect(patient).approveVisibilityRenewal(0);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const expectedExpiry = block.timestamp + 30 * 24 * 60 * 60;

    await expect(tx).to.emit(claimRegistry, "VisibilityRenewed").withArgs(0, expectedExpiry);
    expect(await claimRegistry.hasFullVisibility(0)).to.equal(true);
  });

  it("rejects requesting a visibility renewal while still within the window", async function () {
    await claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "x", 100);
    await claimRegistry.connect(patient).approvePatientVisibility(0);

    await expect(claimRegistry.connect(insurer).requestVisibilityRenewal(0)).to.be.revertedWith("Still visible");
  });

  it("rejects submitClaim from a non-provider, for a record it didn't issue, or belonging to a different patient", async function () {
    await expect(
      claimRegistry.connect(doctor).submitClaim(patient.address, insurer.address, [0], "x", 100)
    ).to.be.revertedWith("Not an authorized provider");

    await expect(
      claimRegistry.connect(otherPharmacy).submitClaim(patient.address, insurer.address, [0], "x", 100)
    ).to.be.revertedWith("Record not issued by caller");

    await medicalRecordRegistry.connect(pharmacy).createRecord(otherPatient.address, RecordType.Prescription, "cid-other");
    await expect(
      claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [1], "x", 100)
    ).to.be.revertedWith("Record does not belong to patient");
  });

  it("rejects submitClaim targeting a non-patient or non-insurer", async function () {
    await expect(
      claimRegistry.connect(pharmacy).submitClaim(doctor.address, insurer.address, [0], "x", 100)
    ).to.be.revertedWith("Not a patient");
    await expect(
      claimRegistry.connect(pharmacy).submitClaim(patient.address, doctor.address, [0], "x", 100)
    ).to.be.revertedWith("Not an insurer");
  });

  it("blocks the insurer from acting before the patient approves visibility", async function () {
    await claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "x", 100);

    await expect(claimRegistry.connect(insurer).approveClaim(0)).to.be.revertedWith("Not pending");
    await expect(claimRegistry.connect(insurer).rejectClaim(0)).to.be.revertedWith("Not pending");
  });

  it("lets the patient deny visibility, permanently hiding the claim from insurer action", async function () {
    await claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "x", 100);

    await expect(claimRegistry.connect(patient).denyPatientVisibility(0))
      .to.emit(claimRegistry, "ClaimPatientDenied")
      .withArgs(0);

    await expect(claimRegistry.connect(insurer).approveClaim(0)).to.be.revertedWith("Not pending");
  });

  it("only lets the claim's own patient approve/deny visibility, and only the claim's own insurer decide it", async function () {
    await claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "x", 100);

    await expect(claimRegistry.connect(otherPatient).approvePatientVisibility(0)).to.be.revertedWith(
      "Only the patient"
    );

    await claimRegistry.connect(patient).approvePatientVisibility(0);
    await expect(claimRegistry.connect(doctor).approveClaim(0)).to.be.revertedWith("Only the claim's insurer");
  });

  it("tracks claims per patient, provider, and insurer", async function () {
    await claimRegistry.connect(pharmacy).submitClaim(patient.address, insurer.address, [0], "x", 100);

    expect((await claimRegistry.getClaimsForPatient(patient.address)).length).to.equal(1);
    expect((await claimRegistry.getClaimsForProvider(pharmacy.address)).length).to.equal(1);
    expect((await claimRegistry.getClaimsForInsurer(insurer.address)).length).to.equal(1);
  });
});
