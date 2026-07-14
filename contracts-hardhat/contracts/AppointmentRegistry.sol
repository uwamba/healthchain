// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IdentityRegistry.sol";

/// @title AppointmentRegistry
/// @notice Deliberately thin: appointments have no ownership/trust property
/// that truly requires a blockchain, except for one — a patient can
/// independently verify their doctor was never silently double-booked, since
/// this check is enforced by the contract itself, not a database an
/// administrator could quietly edit after the fact.
contract AppointmentRegistry {

    IdentityRegistry public immutable identityRegistry;

    enum Status { Booked, Cancelled }

    struct Appointment {
        uint id;
        address patient;
        address doctor;
        uint scheduledFor; // unix timestamp
        string reason;
        Status status;
    }

    Appointment[] public appointments;

    // doctor => timestamp => taken. Cleared again on cancellation so the
    // slot can be rebooked.
    mapping(address => mapping(uint => bool)) public doctorSlotTaken;

    event AppointmentBooked(uint indexed id, address indexed patient, address indexed doctor, uint scheduledFor);
    event AppointmentCancelled(uint indexed id);

    constructor(address identityRegistryAddress) {
        identityRegistry = IdentityRegistry(identityRegistryAddress);
    }

    /// @notice Books an appointment between the calling patient and a doctor.
    /// @param doctor Address of the doctor to book.
    /// @param scheduledFor Unix timestamp, must be in the future.
    /// @param reason Free-text reason for the visit.
    function bookAppointment(
        address doctor,
        uint scheduledFor,
        string memory reason
    ) external {
        require(identityRegistry.roleOf(msg.sender) == IdentityRegistry.Role.Patient, "Only patients can book");
        require(identityRegistry.roleOf(doctor) == IdentityRegistry.Role.Doctor, "Not a doctor");
        require(scheduledFor > block.timestamp, "Must be in the future");
        require(!doctorSlotTaken[doctor][scheduledFor], "Slot already booked");

        uint id = appointments.length;
        appointments.push(Appointment({
            id: id,
            patient: msg.sender,
            doctor: doctor,
            scheduledFor: scheduledFor,
            reason: reason,
            status: Status.Booked
        }));
        doctorSlotTaken[doctor][scheduledFor] = true;

        emit AppointmentBooked(id, msg.sender, doctor, scheduledFor);
    }

    /// @notice Cancels a booked appointment, freeing the doctor's slot for rebooking.
    /// @dev Callable only by the appointment's own patient or doctor.
    function cancelAppointment(uint appointmentId) external {
        Appointment storage appt = appointments[appointmentId];
        require(msg.sender == appt.patient || msg.sender == appt.doctor, "Not authorized");
        require(appt.status == Status.Booked, "Not booked");

        appt.status = Status.Cancelled;
        doctorSlotTaken[appt.doctor][appt.scheduledFor] = false;

        emit AppointmentCancelled(appointmentId);
    }
}
