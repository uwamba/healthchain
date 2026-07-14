"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Shared by Patient (book) and Doctor (manage) dashboards — same month-grid
// view, only the actions rendered per selected day differ by caller.
export default function AppointmentCalendar({ appointments, renderDay }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);

  const { year, month, weeks, monthLabel } = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const y = base.getFullYear();
    const m = base.getMonth();

    const firstDayOfWeek = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    const weekRows = [];
    for (let i = 0; i < cells.length; i += 7) weekRows.push(cells.slice(i, i + 7));

    return {
      year: y,
      month: m,
      weeks: weekRows,
      monthLabel: base.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    };
  }, [monthOffset]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map();
    for (const a of appointments) {
      const d = new Date(a.scheduledFor * 1000);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      map.set(day, [...(map.get(day) ?? []), a]);
    }
    return map;
  }, [appointments, year, month]);

  const selectedDayAppointments = selectedDate ? appointmentsByDay.get(selectedDate) ?? [] : [];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonthOffset((v) => v - 1)} className="p-1 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-medium text-sm">{monthLabel}</p>
        <button onClick={() => setMonthOffset((v) => v + 1)} className="p-1 hover:bg-gray-100 rounded-lg">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, i) => {
          const hasAppointments = day && appointmentsByDay.has(day);
          return (
            <button
              key={i}
              disabled={!day}
              onClick={() => setSelectedDate(day)}
              className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition-colors ${
                !day
                  ? "invisible"
                  : selectedDate === day
                    ? "bg-brand text-white"
                    : "hover:bg-gray-100"
              }`}
            >
              {day}
              {hasAppointments && <span className={`h-1 w-1 rounded-full ${selectedDate === day ? "bg-white" : "bg-blockchain-purple"}`} />}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          {renderDay ? renderDay(selectedDayAppointments, selectedDate) : <p className="text-xs text-gray-400">No renderer provided.</p>}
        </div>
      )}
    </div>
  );
}
