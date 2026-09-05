"use client";

import Link from "next/link";
import { Check } from "lucide-react";

type ChecklistItem = {
  key: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
  actionLabel: string;
};

export function OnboardingChecklist({
  tenantName,
  items,
}: {
  tenantName: string;
  items: ChecklistItem[];
}) {
  const doneCount = items.filter((i) => i.done).length;
  const progress = Math.round((doneCount / items.length) * 100);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Welcome, {tenantName}</h1>
        <span className="font-mono text-sm text-black/40 dark:text-white/40">
          {doneCount} / {items.length} done
        </span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-orange-500 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/10 ${
              item.done ? "opacity-60" : ""
            }`}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs ${
                item.done
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-black/20 dark:border-white/20"
              }`}
            >
              {item.done && <Check size={14} />}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-black/50 dark:text-white/50">{item.description}</div>
            </div>
            {!item.done && (
              <Link
                href={item.href}
                className="rounded-md border border-black/15 px-3 py-1.5 text-xs dark:border-white/15"
              >
                {item.actionLabel}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
