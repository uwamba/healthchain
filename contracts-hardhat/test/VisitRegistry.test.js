const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VisitRegistry", function () {
  let identityRegistry, visitRegistry;
  let patient, hospital, doctor, otherHospital, stranger;

  const Role = { None: 0, Patient: 1, Doctor: 2, Hospital: 3, Laboratory: 4, Pharmacy: 5, Insurer: 6 };
  const VisitStatus = { Requested: 0, CheckedIn: 1, Cancelled: 2 };

  beforeEach(async function () {
    [patient, hospital, doctor, otherHospital, stranger] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.deployed();

    const VisitRegistry = await ethers.getContractFactory("VisitRegistry");
    visitRegistry = await VisitRegistry.deploy(identityRegistry.address);
    await visitRegistry.deployed();

    await identityRegistry.connect(patient).register(Role.Patient, "Alice", "", "", "");
    await identityRegistry.connect(hospital).register(Role.Hospital, "Front Desk", "Central Hospital", "", "");
    await identityRegistry.connect(doctor).register(Role.Doctor, "Dr. Smith", "", "", "");
    await identityRegistry.connect(otherHospital).register(Role.Hospital, "Front Desk 2", "Other Hospital", "", "");
  });

  it("lets a hospital request a visit and the patient approve it", async function () {
    await expect(visitRegistry.connect(hospital).requestVisit(patient.address))
      .to.emit(visitRegistry, "VisitRequested")
      .withArgs(0, patient.address, hospital.address);

    await expect(visitRegistry.connect(patient).approveVisit(0))
      .to.emit(visitRegistry, "VisitApproved")
      .withArgs(0);

    const visit = await visitRegistry.visits(0);
    expect(visit.status).to.equal(VisitStatus.CheckedIn);
    expect(visit.checkedInAt).to.not.equal(0);
  });

  it("rejects requestVisit from a non-hospital or targeting a non-patient", async function () {
    await expect(visitRegistry.connect(patient).requestVisit(patient.address)).to.be.revertedWith(
      "Only hospitals"
    );
    await expect(visitRegistry.connect(hospital).requestVisit(doctor.address)).to.be.revertedWith(
      "Not a patient"
    );
  });

  it("lets the hospital assign a doctor to the visit", async function () {
    await visitRegistry.connect(hospital).requestVisit(patient.address);

    await expect(visitRegistry.connect(hospital).assignDoctor(0, doctor.address))
      .to.emit(visitRegistry, "VisitDoctorAssigned")
      .withArgs(0, doctor.address);

    const visit = await visitRegistry.visits(0);
    expect(visit.assignedDoctor).to.equal(doctor.address);
  });

  it("rejects assignDoctor from a different hospital or a non-doctor target", async function () {
    await visitRegistry.connect(hospital).requestVisit(patient.address);

    await expect(visitRegistry.connect(otherHospital).assignDoctor(0, doctor.address)).to.be.revertedWith(
      "Only this visit's hospital"
    );
    await expect(visitRegistry.connect(hospital).assignDoctor(0, patient.address)).to.be.revertedWith(
      "Not a doctor"
    );
  });

  it("only lets the visit's own patient approve or cancel it", async function () {
    await visitRegistry.connect(hospital).requestVisit(patient.address);

    await expect(visitRegistry.connect(stranger).approveVisit(0)).to.be.revertedWith(
      "Only this visit's patient"
    );
    await expect(visitRegistry.connect(stranger).cancelVisit(0)).to.be.revertedWith("Not authorized");
  });

  it("lets the hospital also cancel, and blocks approving a cancelled visit", async function () {
    await visitRegistry.connect(hospital).requestVisit(patient.address);

    await expect(visitRegistry.connect(hospital).cancelVisit(0))
      .to.emit(visitRegistry, "VisitCancelled")
      .withArgs(0);

    await expect(visitRegistry.connect(patient).approveVisit(0)).to.be.revertedWith("Not awaiting approval");
  });

  it("tracks visits per patient", async function () {
    await visitRegistry.connect(hospital).requestVisit(patient.address);
    await visitRegistry.connect(otherHospital).requestVisit(patient.address);

    const ids = await visitRegistry.getVisitsOfPatient(patient.address);
    expect(ids.length).to.equal(2);
  });
});
