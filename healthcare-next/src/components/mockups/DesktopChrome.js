import { Building2, FlaskConical, HeartPulse, Pill, ShieldCheck, Stethoscope } from "lucide-react";

// Bigger "desktop window" frame for the full-journey carousel — traffic
// lights + fake URL bar like BrowserFrame, plus a slim icon nav-rail on the
// left (the same shape every real dashboard in this app uses) so whichever
// step is showing reads as "this role's actual dashboard," not a generic box.
const ROLE_NAV = [
  { key: "patient", icon: HeartPulse },
  { key: "doctor", icon: Stethoscope },
  { key: "hospital", icon: Building2 },
  { key: "laboratory", icon: FlaskConical },
  { key: "pharmacy", icon: Pill },
  { key: "insurer", icon: ShieldCheck },
];

export default function DesktopChrome({ url, activeRole, children }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-background">
      <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-100 dark:bg-white/5 border-b border-gray-200">
        <span className="h-3 w-3 rounded-full bg-red-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-medical-green" />
        <span className="mx-auto rounded-md bg-white/60 dark:bg-black/20 px-3 py-1 text-xs font-mono text-gray-400">
          {url}
        </span>
      </div>
      <div className="flex min-h-[300px] sm:min-h-[340px]">
        <div className="hidden sm:flex w-16 shrink-0 flex-col items-center gap-2.5 py-5 border-r border-gray-200 bg-gray-50 dark:bg-white/[0.02]">
          {ROLE_NAV.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors duration-500 ${
                key === activeRole ? "bg-brand text-white" : "text-gray-300 dark:text-gray-600"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
          ))}
        </div>
        <div className="flex-1 p-5 sm:p-6 flex items-center">{children}</div>
      </div>
    </div>
  );
}
