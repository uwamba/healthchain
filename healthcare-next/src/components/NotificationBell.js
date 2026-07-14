"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

export default function NotificationBell() {
  const { notifications, requestBrowserPermission } = useNotifications();
  const [open, setOpen] = useState(false);

  function toggle() {
    // Requesting permission here (inside a real click handler) rather than
    // on mount — browsers ignore/auto-deny Notification.requestPermission()
    // calls that aren't triggered by direct user interaction.
    requestBrowserPermission();
    setOpen((v) => !v);
  }

  return (
    <div className="relative">
      <button onClick={toggle} className="relative text-gray-500 hover:text-foreground transition-colors" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {notifications.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 glass rounded-2xl p-2 z-50">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500 p-4 text-center">Nothing needs your attention right now.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {notifications.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block p-3 text-sm hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    {item.message}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
