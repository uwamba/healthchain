const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AccessControlRegistry", function () {
  let identityRegistry, accessControl;
  let patient, doctor, otherDoctor, pharmacy, hospital;

  const Role = { None: 0, Patient: 1, Doctor: 2, Hospital: 3, Laboratory: 4, Pharmacy: 5, Insurer: 6 };
  const Duration = { OneDay: 0, OneWeek: 1, OneMonth: 2 };

  beforeEach(async function () {
    [patient, doctor, otherDoctor, pharmacy, hospital] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.deployed();

    const AccessControlRegistry = await ethers.getContractFactory("AccessControlRegistry");
    accessControl = await AccessControlRegistry.deploy(identityRegistry.address);
    await accessControl.deployed();

    await identityRegistry.connect(patient).register(Role.Patient, "Alice", "");
    await identityRegistry.connect(doctor).register(Role.Doctor, "Dr. Smith", "");
    await identityRegistry.connect(otherDoctor).register(Role.Doctor, "Dr. Jones", "");
    await identityRegistry.connect(pharmacy).register(Role.Pharmacy, "Pharmacist Joe", "MedPlus");
    await identityRegistry.connect(hospital).register(Role.Hospital, "Admin", "General Hospital");
  });

  it("walks the full request -> approve -> hasAccess lifecycle", async function () {
    await expect(accessControl.connect(doctor).requestAccess(patient.address))
      .to.emit(accessControl, "AccessRequested")
      .withArgs(patient.address, doctor.address);

    expect(await accessControl.hasAccess(patient.address, doctor.address)).to.equal(false);

    const tx = await accessControl.connect(patient).approveAccess(doctor.address, Duration.OneWeek);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const expectedExpiry = block.timestamp + 7 * 24 * 60 * 60;

    await expect(tx).to.emit(accessControl, "AccessApproved").withArgs(patient.address, doctor.address, expectedExpiry);
    expect(await accessControl.hasAccess(patient.address, doctor.address)).to.equal(true);
  });

  it("rejects requestAccess from a non-doctor, non-pharmacy caller", async function () {
    await expect(accessControl.connect(patient).requestAccess(patient.address)).to.be.revertedWith(
      "Only doctors or pharmacies"
    );
    await expect(accessControl.connect(hospital).requestAccess(patient.address)).to.be.revertedWith(
      "Only doctors or pharmacies"
    );
  });

  it("lets a pharmacy walk the same request -> approve -> hasAccess lifecycle as a doctor", async function () {
    await expect(accessControl.connect(pharmacy).requestAccess(patient.address))
      .to.emit(accessControl, "AccessRequested")
      .withArgs(patient.address, pharmacy.address);

    expect(await accessControl.hasAccess(patient.address, pharmacy.address)).to.equal(false);

    await accessControl.connect(patient).approveAccess(pharmacy.address, Duration.OneDay);
    expect(await accessControl.hasAccess(patient.address, pharmacy.address)).to.equal(true);
  });

  it("rejects approveAccess/denyAccess without a pending request", async function () {
    await expect(
      accessControl.connect(patient).approveAccess(doctor.address, Duration.OneDay)
    ).to.be.revertedWith("No pending request");
    await expect(accessControl.connect(patient).denyAccess(doctor.address)).to.be.revertedWith(
      "No pending request"
    );
  });

  it("lets the patient deny a request, leaving hasAccess false", async function () {
    await accessControl.connect(doctor).requestAccess(patient.address);

    await expect(accessControl.connect(patient).denyAccess(doctor.address))
      .to.emit(accessControl, "AccessDenied")
      .withArgs(patient.address, doctor.address);

    expect(await accessControl.hasAccess(patient.address, doctor.address)).to.equal(false);
  });

  it("lets the patient revoke an approved grant early", async function () {
    await accessControl.connect(doctor).requestAccess(patient.address);
    await accessControl.connect(patient).approveAccess(doctor.address, Duration.OneMonth);
    expect(await accessControl.hasAccess(patient.address, doctor.address)).to.equal(true);

    await expect(accessControl.connect(patient).revokeAccess(doctor.address))
      .to.emit(accessControl, "AccessRevoked")
      .withArgs(patient.address, doctor.address);

    expect(await accessControl.hasAccess(patient.address, doctor.address)).to.equal(false);
  });

  it("expires access once the granted duration has elapsed", async function () {
    await accessControl.connect(doctor).requestAccess(patient.address);
    await accessControl.connect(patient).approveAccess(doctor.address, Duration.OneDay);
    expect(await accessControl.hasAccess(patient.address, doctor.address)).to.equal(true);

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");

    expect(await accessControl.hasAccess(patient.address, doctor.address)).to.equal(false);
  });

  it("rejects a doctor re-requesting while an unexpired approved grant exists", async function () {
    await accessControl.connect(doctor).requestAccess(patient.address);
    await accessControl.connect(patient).approveAccess(doctor.address, Duration.OneWeek);

    await expect(accessControl.connect(doctor).requestAccess(patient.address)).to.be.revertedWith(
      "Access already granted"
    );
  });

  it("keeps grants independent per doctor", async function () {
    await accessControl.connect(doctor).requestAccess(patient.address);
    await accessControl.connect(patient).approveAccess(doctor.address, Duration.OneWeek);

    await accessControl.connect(otherDoctor).requestAccess(patient.address);
    expect(await accessControl.hasAccess(patient.address, otherDoctor.address)).to.equal(false);
    expect(await accessControl.hasAccess(patient.address, doctor.address)).to.equal(true);
  });
});
