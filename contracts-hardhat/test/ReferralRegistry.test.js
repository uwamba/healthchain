const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReferralRegistry", function () {
  let identityRegistry, nft, medicalRecordRegistry, referralRegistry;
  let patient, doctor, lab, otherLab, otherPatient;

  const Role = { None: 0, Patient: 1, Doctor: 2, Hospital: 3, Laboratory: 4, Pharmacy: 5, Insurer: 6 };
  const RecordType = { Consultation: 0, LabResult: 1, Prescription: 2, Imaging: 3, Discharge: 4, Vaccination: 5 };
  const ReferralStatus = { Requested: 0, Approved: 1, Denied: 2, Completed: 3, ResultApproved: 4 };

  beforeEach(async function () {
    [patient, doctor, lab, otherLab, otherPatient] = await ethers.getSigners();

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

    const ReferralRegistry = await ethers.getContractFactory("ReferralRegistry");
    referralRegistry = await ReferralRegistry.deploy(identityRegistry.address, medicalRecordRegistry.address);
    await referralRegistry.deployed();

    await identityRegistry.connect(patient).register(Role.Patient, "Alice", "", "", "");
    await identityRegistry.connect(otherPatient).register(Role.Patient, "Bob", "", "", "");
    await identityRegistry.connect(doctor).register(Role.Doctor, "Dr. Smith", "", "", "");
    await identityRegistry.connect(lab).register(Role.Laboratory, "Central Lab", "Central Lab", "", "");
    await identityRegistry.connect(otherLab).register(Role.Laboratory, "Other Lab", "Other Lab", "", "");
  });

  it("walks the full happy path: create -> approve -> complete -> approve result", async function () {
    await expect(referralRegistry.connect(doctor).createReferral(patient.address, lab.address, "Blood panel"))
      .to.emit(referralRegistry, "ReferralRequested")
      .withArgs(0, doctor.address, lab.address, patient.address);

    await expect(referralRegistry.connect(patient).approveReferral(0))
      .to.emit(referralRegistry, "ReferralApproved")
      .withArgs(0);

    await medicalRecordRegistry.connect(lab).createRecord(patient.address, RecordType.LabResult, "cid-result");

    await expect(referralRegistry.connect(lab).completeReferral(0, 0))
      .to.emit(referralRegistry, "ReferralCompleted")
      .withArgs(0, 0);

    await expect(referralRegistry.connect(patient).approveReferralResult(0))
      .to.emit(referralRegistry, "ReferralResultApproved")
      .withArgs(0);

    const referral = await referralRegistry.referrals(0);
    expect(referral.status).to.equal(ReferralStatus.ResultApproved);
    expect(referral.resultRecordId).to.equal(0);
  });

  it("rejects createReferral from a non-doctor, targeting a non-lab, or a non-patient", async function () {
    await expect(
      referralRegistry.connect(patient).createReferral(patient.address, lab.address, "x")
    ).to.be.revertedWith("Only doctors");
    await expect(
      referralRegistry.connect(doctor).createReferral(patient.address, doctor.address, "x")
    ).to.be.revertedWith("Not a laboratory");
    await expect(
      referralRegistry.connect(doctor).createReferral(lab.address, lab.address, "x")
    ).to.be.revertedWith("Not a patient");
  });

  it("lets the patient deny a referral instead of approving it", async function () {
    await referralRegistry.connect(doctor).createReferral(patient.address, lab.address, "Blood panel");

    await expect(referralRegistry.connect(patient).denyReferral(0))
      .to.emit(referralRegistry, "ReferralDenied")
      .withArgs(0);
  });

  it("rejects completeReferral before approval, from a different lab, or with someone else's record", async function () {
    await referralRegistry.connect(doctor).createReferral(patient.address, lab.address, "Blood panel");

    await medicalRecordRegistry.connect(lab).createRecord(patient.address, RecordType.LabResult, "cid-result");
    await expect(referralRegistry.connect(lab).completeReferral(0, 0)).to.be.revertedWith("Not approved");

    await referralRegistry.connect(patient).approveReferral(0);

    await expect(referralRegistry.connect(otherLab).completeReferral(0, 0)).to.be.revertedWith(
      "Only this referral's provider"
    );

    await medicalRecordRegistry.connect(lab).createRecord(otherPatient.address, RecordType.LabResult, "cid-other");
    await expect(referralRegistry.connect(lab).completeReferral(0, 1)).to.be.revertedWith(
      "Record does not belong to referral's patient"
    );
  });

  it("rejects approveReferralResult before completion, and rejects a non-patient caller", async function () {
    await referralRegistry.connect(doctor).createReferral(patient.address, lab.address, "Blood panel");
    await referralRegistry.connect(patient).approveReferral(0);

    await expect(referralRegistry.connect(patient).approveReferralResult(0)).to.be.revertedWith(
      "Not yet completed"
    );

    await medicalRecordRegistry.connect(lab).createRecord(patient.address, RecordType.LabResult, "cid-result");
    await referralRegistry.connect(lab).completeReferral(0, 0);

    await expect(referralRegistry.connect(otherPatient).approveReferralResult(0)).to.be.revertedWith(
      "Only this referral's patient"
    );
  });

  it("tracks referrals per patient", async function () {
    await referralRegistry.connect(doctor).createReferral(patient.address, lab.address, "Blood panel");
    await referralRegistry.connect(doctor).createReferral(patient.address, otherLab.address, "X-ray");

    const ids = await referralRegistry.getReferralsOfPatient(patient.address);
    expect(ids.length).to.equal(2);
  });
});
