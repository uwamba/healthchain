"use client";

import EmptyState from "@/components/EmptyState";
import { SkeletonRow } from "@/components/Skeleton";

// Shared "list of blockchain events" presentation — used by Hospital's
// network-wide Activity Log and the Patient dashboard's own event history.
export default function ActivityFeed({ events, emptyDescription = "Every action across the ecosystem will be listed here." }) {
  if (events === null) return <SkeletonRow />;
  if (events.length === 0) {
    return <EmptyState title="No activity yet" description={emptyDescription} />;
  }
  return (
    <div className="glass rounded-2xl divide-y divide-gray-100 p-1">
      {events.map((event) => (
        <div key={`${event.transactionHash}-${event.eventName}`} className="p-3 flex items-center justify-between gap-3">
          <p className="text-sm">{event.description}</p>
          <p className="text-xs text-gray-400 font-mono">
            {event.timestamp ? new Date(event.timestamp * 1000).toLocaleString() : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
