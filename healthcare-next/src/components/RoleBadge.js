import { roleLabel } from "@/lib/identityRegistry";

// Color-coded per role so the connected wallet's badge is glanceable —
// reinforces "your role is a verified on-chain fact", not a settings toggle.
const ROLE_STYLES = {
  Patient: "bg-brand-pale text-brand",
  Doctor: "bg-medical-green-pale text-medical-green",
  Hospital: "bg-blockchain-purple-pale text-blockchain-purple",
  Laboratory: "bg-blockchain-purple-pale text-blockchain-purple",
  Pharmacy: "bg-medical-green-pale text-medical-green",
  Insurer: "bg-brand-pale text-brand",
  None: "bg-gray-100 text-gray-500",
  Unknown: "bg-gray-100 text-gray-500",
};

export default function RoleBadge({ role, className = "" }) {
  const label = roleLabel(role);
  const style = ROLE_STYLES[label] ?? ROLE_STYLES.Unknown;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  );
}
