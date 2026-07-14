// Static "browser chrome" wrapper for illustrative UI mockups on the
// /workflow page — purely decorative, no live data or wallet context.
// Traffic-light dots + a fake address bar sell "this is a real screen"
// at a glance, same trick any product marketing page uses.
export default function BrowserFrame({ url, children }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-background">
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 dark:bg-white/5 border-b border-gray-200">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-medical-green" />
        <span className="ml-3 rounded-md bg-white/60 dark:bg-black/20 px-2.5 py-0.5 text-[11px] font-mono text-gray-400 truncate">
          {url}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
