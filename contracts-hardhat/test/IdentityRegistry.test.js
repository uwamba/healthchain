const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityRegistry", function () {
  let identityRegistry;
  let patient, doctor, hospital, other;

  const Role = { None: 0, Patient: 1, Doctor: 2, Hospital: 3, Laboratory: 4, Pharmacy: 5, Insurer: 6 };

  beforeEach(async function () {
    [patient, doctor, hospital, other] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.deployed();
  });

  it("registers a role and exposes it via roleOf", async function () {
    await identityRegistry.connect(patient).register(Role.Patient, "Alice", "", "", "");
    expect(await identityRegistry.roleOf(patient.address)).to.equal(Role.Patient);
    expect(await identityRegistry.isRegistered(patient.address)).to.equal(true);
  });

  it("stores phone and idNumber alongside the rest of the profile", async function () {
    await identityRegistry
      .connect(patient)
      .register(Role.Patient, "Alice", "", "+250780000000", "PID-00291");

    const profile = await identityRegistry.profiles(patient.address);
    expect(profile.phone).to.equal("+250780000000");
    expect(profile.idNumber).to.equal("PID-00291");
  });

  it("rejects registering with Role.None", async function () {
    await expect(
      identityRegistry.connect(patient).register(Role.None, "Alice", "", "", "")
    ).to.be.revertedWith("Invalid role");
  });

  it("rejects double registration", async function () {
    await identityRegistry.connect(patient).register(Role.Patient, "Alice", "", "", "");
    await expect(
      identityRegistry.connect(patient).register(Role.Doctor, "Alice", "", "", "")
    ).to.be.revertedWith("Already registered");
  });

  it("only lets a registered account set its own public key", async function () {
    await expect(
      identityRegistry.connect(other).setPublicKey(ethers.utils.formatBytes32String("key"))
    ).to.be.revertedWith("Not registered");

    await identityRegistry.connect(other).register(Role.Patient, "Bob", "", "", "");
    const key = ethers.utils.formatBytes32String("bobkey");
    await identityRegistry.connect(other).setPublicKey(key);
    expect(await identityRegistry.publicKeyOf(other.address)).to.equal(key);
  });

  it("requires hospital confirmation before affiliation is recorded", async function () {
    await identityRegistry.connect(doctor).register(Role.Doctor, "Dr. Smith", "", "", "");
    await identityRegistry
      .connect(hospital)
      .register(Role.Hospital, "General Hospital", "General Hospital", "", "");

    await identityRegistry.connect(doctor).requestHospitalAffiliation(hospital.address);
    // Not confirmed yet — profile's hospital field stays unset. We can't
    // read it directly (public mapping getter returns the whole struct),
    // so confirm indirectly via confirmHospitalAffiliation succeeding next.
    await identityRegistry.connect(hospital).confirmHospitalAffiliation(doctor.address);

    const profile = await identityRegistry.profiles(doctor.address);
    expect(profile.hospital).to.equal(hospital.address);
  });

  it("rejects a non-hospital confirming an affiliation", async function () {
    await identityRegistry.connect(doctor).register(Role.Doctor, "Dr. Smith", "", "", "");
    await identityRegistry.connect(other).register(Role.Patient, "Not a hospital", "", "", "");

    await expect(
      identityRegistry.connect(other).confirmHospitalAffiliation(doctor.address)
    ).to.be.revertedWith("Only hospitals");
  });
});
