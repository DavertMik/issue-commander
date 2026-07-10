"use client";

import { CalendarDays, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/lib/filters";

interface Props {
  /** Contextual noun for the date being ranged: "Opened" | "Closed" | "Merged". */
  label: string;
  value: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

/** Shared with the F-key filter dialog, which offers the same presets as a dropdown. */
export const DATE_PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Today", range: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { label: "Last 7 days", range: () => ({ from: daysAgo(6), to: ymd(new Date()) }) },
  { label: "Last 30 days", range: () => ({ from: daysAgo(29), to: ymd(new Date()) }) },
  { label: "Last 90 days", range: () => ({ from: daysAgo(89), to: ymd(new Date()) }) },
];

/** Short "Jul 3" from a yyyy-mm-dd string, in the local calendar. */
function fmt(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function summarizeRange(label: string, r: DateRange): string {
  if (!r.from && !r.to) return `${label} anytime`;
  if (r.from && r.to) return r.from === r.to ? `${label} ${fmt(r.from)}` : `${label} ${fmt(r.from)} – ${fmt(r.to)}`;
  if (r.from) return `${label} ≥ ${fmt(r.from)}`;
  return `${label} ≤ ${fmt(r.to!)}`;
}

export function DateRangeFilter({ label, value, onChange, className }: Props) {
  const active = !!(value.from || value.to);
  return (
    <Popover>
      <div className={cn("relative flex h-7", className)}>
        <PopoverTrigger
          className={cn(
            "flex h-full w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <CalendarDays className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{summarizeRange(label, value)}</span>
        </PopoverTrigger>
        {active && (
          <button
            type="button"
            title="Clear"
            onClick={() => onChange({ from: null, to: null })}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <PopoverContent align="start" className="w-64 gap-2">
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.range())}
              className="rounded border border-input bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="w-8">From</span>
          <input
            type="date"
            value={value.from ?? ""}
            max={value.to ?? undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value || null })}
            className="h-7 flex-1 rounded border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-input/30"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="w-8">To</span>
          <input
            type="date"
            value={value.to ?? ""}
            min={value.from ?? undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value || null })}
            className="h-7 flex-1 rounded border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-input/30"
          />
        </label>

        {active && (
          <button
            type="button"
            onClick={() => onChange({ from: null, to: null })}
            className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
