export const APPOINTMENT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_APPOINTMENT_REGISTRY_ADDRESS;

export const APPOINTMENT_REGISTRY_ABI = [
  "function bookAppointment(address doctor, uint scheduledFor, string memory reason)",
  "function confirmAppointment(uint appointmentId)",
  "function declineAppointment(uint appointmentId)",
  "function cancelAppointment(uint appointmentId)",
  "function appointments(uint) view returns (uint id, address patient, address doctor, uint scheduledFor, string reason, uint8 status)",
  "event AppointmentBooked(uint indexed id, address indexed patient, address indexed doctor, uint scheduledFor)",
  "event AppointmentConfirmed(uint indexed id)",
  "event AppointmentDeclined(uint indexed id)",
  "event AppointmentCancelled(uint indexed id)",
];

// Mirrors AppointmentRegistry.sol's enum — index === on-chain uint8 value.
export const APPOINTMENT_STATUS = ["Requested", "Confirmed", "Declined", "Cancelled"];

export function appointmentStatusLabel(status) {
  return APPOINTMENT_STATUS[status] ?? "Unknown";
}

// Solidity's auto-getter for a public array only supports per-index reads,
// not "give me the whole array" — read sequentially until an out-of-bounds
// index reverts, same pattern as web3/marketplace-next's loadAllProducts.
export async function loadAllAppointments(appointmentRegistry) {
  const results = [];
  let index = 0;

  while (true) {
    try {
      const a = await appointmentRegistry.appointments(index);
      results.push({
        id: a.id.toNumber(),
        patient: a.patient,
        doctor: a.doctor,
        scheduledFor: a.scheduledFor.toNumber(),
        reason: a.reason,
        status: a.status,
      });
      index++;
    } catch {
      break;
    }
  }

  return results;
}
