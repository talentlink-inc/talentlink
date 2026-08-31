"use client";

import { useMemo, useState } from "react";
import type { SerializedInterview } from "./types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function InterviewCalendar({
  interviews,
  onSelect,
}: {
  interviews: SerializedInterview[];
  onSelect: (interview: SerializedInterview) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const byDay = useMemo(() => {
    const map = new Map<string, SerializedInterview[]>();
    for (const i of interviews) {
      if (!i.scheduledAt) continue;
      const key = dayKey(new Date(i.scheduledAt));
      const list = map.get(key) ?? [];
      list.push(i);
      map.set(key, list);
    }
    return map;
  }, [interviews]);

  const cells = useMemo(() => {
    const firstWeekday = cursor.getDay();
    const totalDays = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) result.push(null);
    for (let d = 1; d <= totalDays; d++) result.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = new Date();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          ‹ Prev
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{monthLabel}</h2>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Next ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-black/10 bg-black/10 dark:border-white/10 dark:bg-white/10">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="bg-black/5 px-2 py-1 text-center text-xs font-medium text-black/50 dark:bg-neutral-900 dark:text-white/50"
          >
            {d}
          </div>
        ))}
        {cells.map((date, idx) => {
          const key = date ? dayKey(date) : `empty-${idx}`;
          const dayInterviews = date ? (byDay.get(key) ?? []) : [];
          const isToday = date && date.toDateString() === today.toDateString();
          return (
            <div key={key} className="min-h-[100px] bg-white p-1 dark:bg-black">
              {date && (
                <>
                  <div
                    className={`mb-1 text-xs ${isToday ? "font-bold text-blue-600 dark:text-blue-400" : "text-black/50 dark:text-white/50"}`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayInterviews.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => onSelect(i)}
                        title={`${i.submission.candidate.name} — ${i.interviewType}`}
                        className="block w-full truncate rounded bg-indigo-100 px-1 py-0.5 text-left text-[11px] text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                      >
                        {i.scheduledAt &&
                          new Date(i.scheduledAt).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                        {i.submission.candidate.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
