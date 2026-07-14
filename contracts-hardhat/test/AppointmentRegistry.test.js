const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AppointmentRegistry", function () {
  let identityRegistry, appointmentRegistry;
  let patient, doctor, otherPatient;
  let futureTimestamp;

  const Role = { None: 0, Patient: 1, Doctor: 2, Hospital: 3, Laboratory: 4, Pharmacy: 5, Insurer: 6 };

  beforeEach(async function () {
    [patient, doctor, otherPatient] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.deployed();

    const AppointmentRegistry = await ethers.getContractFactory("AppointmentRegistry");
    appointmentRegistry = await AppointmentRegistry.deploy(identityRegistry.address);
    await appointmentRegistry.deployed();

    await identityRegistry.connect(patient).register(Role.Patient, "Alice", "");
    await identityRegistry.connect(doctor).register(Role.Doctor, "Dr. Smith", "");
    await identityRegistry.connect(otherPatient).register(Role.Patient, "Bob", "");

    const latestBlock = await ethers.provider.getBlock("latest");
    futureTimestamp = latestBlock.timestamp + 3600; // 1 hour from now
  });

  it("books an appointment between a patient and a doctor", async function () {
    await expect(
      appointmentRegistry.connect(patient).bookAppointment(doctor.address, futureTimestamp, "Checkup")
    )
      .to.emit(appointmentRegistry, "AppointmentBooked")
      .withArgs(0, patient.address, doctor.address, futureTimestamp);

    const appt = await appointmentRegistry.appointments(0);
    expect(appt.patient).to.equal(patient.address);
    expect(appt.doctor).to.equal(doctor.address);
    expect(appt.status).to.equal(0); // Booked
  });

  it("rejects double-booking the same doctor at the same timestamp — the core trust property", async function () {
    await appointmentRegistry.connect(patient).bookAppointment(doctor.address, futureTimestamp, "Checkup");

    await expect(
      appointmentRegistry.connect(otherPatient).bookAppointment(doctor.address, futureTimestamp, "Follow-up")
    ).to.be.revertedWith("Slot already booked");
  });

  it("allows rebooking a slot after the original appointment is cancelled", async function () {
    await appointmentRegistry.connect(patient).bookAppointment(doctor.address, futureTimestamp, "Checkup");
    await appointmentRegistry.connect(patient).cancelAppointment(0);

    await expect(
      appointmentRegistry.connect(otherPatient).bookAppointment(doctor.address, futureTimestamp, "Follow-up")
    ).to.not.be.reverted;
  });

  it("rejects booking with a non-doctor address", async function () {
    await expect(
      appointmentRegistry.connect(patient).bookAppointment(otherPatient.address, futureTimestamp, "Checkup")
    ).to.be.revertedWith("Not a doctor");
  });

  it("rejects booking a timestamp in the past", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    await expect(
      appointmentRegistry.connect(patient).bookAppointment(doctor.address, latestBlock.timestamp - 10, "Checkup")
    ).to.be.revertedWith("Must be in the future");
  });

  it("only lets the patient or doctor cancel, not a third party", async function () {
    await appointmentRegistry.connect(patient).bookAppointment(doctor.address, futureTimestamp, "Checkup");
    await expect(
      appointmentRegistry.connect(otherPatient).cancelAppointment(0)
    ).to.be.revertedWith("Not authorized");
  });

  it("lets the doctor (not just the patient) cancel", async function () {
    await appointmentRegistry.connect(patient).bookAppointment(doctor.address, futureTimestamp, "Checkup");
    await expect(appointmentRegistry.connect(doctor).cancelAppointment(0)).to.not.be.reverted;

    const appt = await appointmentRegistry.appointments(0);
    expect(appt.status).to.equal(1); // Cancelled
  });
});
