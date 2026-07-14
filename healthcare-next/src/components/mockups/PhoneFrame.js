// Static phone bezel wrapper — for mockups of the patient's own-device
// screens (QR scans, approve/deny), so it's visually obvious those steps
// happen on the patient's phone specifically, not the provider's screen.
export default function PhoneFrame({ children }) {
  return (
    <div className="mx-auto w-full max-w-[220px] rounded-[1.75rem] border-[6px] border-gray-800 dark:border-gray-600 bg-background shadow-lg overflow-hidden">
      <div className="h-5 flex items-center justify-center bg-gray-800 dark:bg-gray-600">
        <div className="h-1.5 w-14 rounded-full bg-gray-600 dark:bg-gray-500" />
      </div>
      <div className="p-3 min-h-[260px] flex flex-col">{children}</div>
    </div>
  );
}
