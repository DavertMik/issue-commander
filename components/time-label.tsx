"use client";

import { useAppStore } from "@/hooks/use-app-store";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/** Localized "3 days ago" / "in 2 months". */
export function relativeTime(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diffSec) >= secs || unit === "second") {
      return rtf.format(Math.round(diffSec / secs), unit);
    }
  }
  return "";
}

/** Date in the current locale; clicking toggles the GLOBAL absolute/relative mode. */
export function TimeLabel({ iso, className }: { iso: string; className?: string }) {
  const relative = useAppStore((s) => s.relativeDates);
  const toggle = useAppStore((s) => s.toggleRelativeDates);
  const absolute = new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const rel = relativeTime(iso);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      title={relative ? absolute : rel}
      className={className ?? "cursor-pointer hover:text-foreground hover:underline"}
    >
      {relative ? rel : absolute}
    </button>
  );
}
