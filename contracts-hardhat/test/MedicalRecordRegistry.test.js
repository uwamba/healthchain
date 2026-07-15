const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MedicalRecordRegistry", function () {
  let identityRegistry, nft, registry;
  let patient, doctor, pharmacy, otherPatient, stranger;

  const Role = { None: 0, Patient: 1, Doctor: 2, Hospital: 3, Laboratory: 4, Pharmacy: 5, Insurer: 6 };
  const RecordType = { Consultation: 0, LabResult: 1, Prescription: 2, Imaging: 3, Discharge: 4, Vaccination: 5 };
  const RecordStatus = { Active: 0, Dispensed: 1, Revoked: 2 };

  beforeEach(async function () {
    [patient, doctor, pharmacy, otherPatient, stranger] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.deployed();

    const MedicalRecordNFT = await ethers.getContractFactory("MedicalRecordNFT");
    nft = await MedicalRecordNFT.deploy();
    await nft.deployed();

    const MedicalRecordRegistry = await ethers.getContractFactory("MedicalRecordRegistry");
    registry = await MedicalRecordRegistry.deploy(identityRegistry.address, nft.address);
    await registry.deployed();

    await nft.setMinter(registry.address);

    await identityRegistry.connect(patient).register(Role.Patient, "Alice", "", "", "");
    await identityRegistry.connect(doctor).register(Role.Doctor, "Dr. Smith", "", "", "");
    await identityRegistry.connect(pharmacy).register(Role.Pharmacy, "Central Pharmacy", "Central Pharmacy", "", "");
    await identityRegistry.connect(otherPatient).register(Role.Patient, "Bob", "", "", "");
  });

  it("creates a record, mints an NFT to the patient, and tracks it in recordsOfPatient", async function () {
    await expect(
      registry.connect(doctor).createRecord(patient.address, RecordType.Consultation, "cid123")
    )
      .to.emit(registry, "RecordCreated")
      .withArgs(0, patient.address, doctor.address, RecordType.Consultation, "cid123", 0);

    expect(await nft.ownerOf(0)).to.equal(patient.address);

    const record = await registry.records(0);
    expect(record.patient).to.equal(patient.address);
    expect(record.issuer).to.equal(doctor.address);
    expect(record.status).to.equal(RecordStatus.Active);

    const patientRecords = await registry.getRecordsOfPatient(patient.address);
    expect(patientRecords.length).to.equal(1);
    expect(patientRecords[0]).to.equal(0);
  });

  it("rejects createRecord from a non-issuer role", async function () {
    await expect(
      registry.connect(otherPatient).createRecord(patient.address, RecordType.Consultation, "cid123")
    ).to.be.revertedWith("Not an authorized issuer");
  });

  it("rejects createRecord targeting a non-patient address", async function () {
    await expect(
      registry.connect(doctor).createRecord(doctor.address, RecordType.Consultation, "cid123")
    ).to.be.revertedWith("Not a patient");
  });

  it("lets a pharmacy dispense a prescription and blocks double-dispensing", async function () {
    await registry.connect(doctor).createRecord(patient.address, RecordType.Prescription, "rx-cid");

    await expect(registry.connect(pharmacy).dispensePrescription(0))
      .to.emit(registry, "PrescriptionDispensed")
      .withArgs(0, pharmacy.address);

    const record = await registry.records(0);
    expect(record.status).to.equal(RecordStatus.Dispensed);
    expect(await registry.dispensedBy(0)).to.equal(pharmacy.address);

    await expect(registry.connect(pharmacy).dispensePrescription(0)).to.be.revertedWith("Not active");
  });

  it("rejects dispensing a non-prescription record", async function () {
    await registry.connect(doctor).createRecord(patient.address, RecordType.LabResult, "lab-cid");

    await expect(registry.connect(pharmacy).dispensePrescription(0)).to.be.revertedWith(
      "Not a prescription"
    );
  });

  it("rejects dispensing from a non-pharmacy role", async function () {
    await registry.connect(doctor).createRecord(patient.address, RecordType.Prescription, "rx-cid");

    await expect(registry.connect(doctor).dispensePrescription(0)).to.be.revertedWith("Only pharmacies");
  });

  it("lets the issuer or patient revoke a record, but not a third party", async function () {
    await registry.connect(doctor).createRecord(patient.address, RecordType.Consultation, "cid123");

    await expect(registry.connect(stranger).revokeRecord(0)).to.be.revertedWith("Not authorized");

    await expect(registry.connect(patient).revokeRecord(0))
      .to.emit(registry, "RecordRevoked")
      .withArgs(0);

    const record = await registry.records(0);
    expect(record.status).to.equal(RecordStatus.Revoked);
  });
});
