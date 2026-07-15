// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IdentityRegistry.sol";

/// @title AppointmentRegistry
/// @notice Appointments have one ownership/trust property that truly
/// requires a blockchain — a patient can independently verify their doctor
/// was never silently double-booked, since this check is enforced by the
/// contract itself, not a database an administrator could quietly edit
/// after the fact. Booking a slot also requires the doctor's own
/// confirmation before it counts as settled, the same request-then-approve
/// shape used by every other consent-sensitive action in this system.
contract AppointmentRegistry {

    IdentityRegistry public immutable identityRegistry;

    enum Status { Requested, Confirmed, Declined, Cancelled }

    struct Appointment {
        uint id;
        address patient;
        address doctor;
        uint scheduledFor; // unix timestamp
        string reason;
        Status status;
    }

    Appointment[] public appointments;

    // doctor => timestamp => taken. Held from the moment of request (not
    // just confirmation) so two patients can never race for the same slot;
    // cleared again on decline/cancellation so the slot can be rebooked.
    mapping(address => mapping(uint => bool)) public doctorSlotTaken;

    event AppointmentBooked(uint indexed id, address indexed patient, address indexed doctor, uint scheduledFor);
    event AppointmentConfirmed(uint indexed id);
    event AppointmentDeclined(uint indexed id);
    event AppointmentCancelled(uint indexed id);

    constructor(address identityRegistryAddress) {
        identityRegistry = IdentityRegistry(identityRegistryAddress);
    }

    /// @notice Requests an appointment between the calling patient and a doctor.
    /// @dev Reserves the slot immediately (see doctorSlotTaken) but leaves the
    /// appointment in Requested status until the doctor confirms it.
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
            status: Status.Requested
        }));
        doctorSlotTaken[doctor][scheduledFor] = true;

        emit AppointmentBooked(id, msg.sender, doctor, scheduledFor);
    }

    /// @notice The doctor confirms a requested appointment.
    function confirmAppointment(uint appointmentId) external {
        Appointment storage appt = appointments[appointmentId];
        require(msg.sender == appt.doctor, "Only the doctor");
        require(appt.status == Status.Requested, "Not requested");

        appt.status = Status.Confirmed;
        emit AppointmentConfirmed(appointmentId);
    }

    /// @notice The doctor declines a requested appointment, freeing the slot.
    function declineAppointment(uint appointmentId) external {
        Appointment storage appt = appointments[appointmentId];
        require(msg.sender == appt.doctor, "Only the doctor");
        require(appt.status == Status.Requested, "Not requested");

        appt.status = Status.Declined;
        doctorSlotTaken[appt.doctor][appt.scheduledFor] = false;
        emit AppointmentDeclined(appointmentId);
    }

    /// @notice Cancels a requested or confirmed appointment, freeing the doctor's slot for rebooking.
    /// @dev Callable only by the appointment's own patient or doctor.
    function cancelAppointment(uint appointmentId) external {
        Appointment storage appt = appointments[appointmentId];
        require(msg.sender == appt.patient || msg.sender == appt.doctor, "Not authorized");
        require(appt.status == Status.Requested || appt.status == Status.Confirmed, "Not active");

        appt.status = Status.Cancelled;
        doctorSlotTaken[appt.doctor][appt.scheduledFor] = false;

        emit AppointmentCancelled(appointmentId);
    }
}
