// Card/row-shaped loading placeholders for the ~1-3s window while
// queryFilter()/contract reads resolve — avoids layout jump so the app reads
// as "fast, professional", not "frozen".
export function SkeletonCard({ className = "" }) {
  return (
    <div className={`glass rounded-2xl p-5 animate-pulse space-y-3 ${className}`}>
      <div className="h-4 w-2/3 rounded bg-gray-200/70" />
      <div className="h-3 w-1/2 rounded bg-gray-200/70" />
      <div className="h-3 w-1/3 rounded bg-gray-200/70" />
    </div>
  );
}

export function SkeletonRow({ className = "" }) {
  return (
    <div className={`animate-pulse flex items-center gap-3 py-2 ${className}`}>
      <div className="h-8 w-8 rounded-full bg-gray-200/70" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded bg-gray-200/70" />
        <div className="h-2.5 w-1/4 rounded bg-gray-200/70" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
