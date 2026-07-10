"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/multi-select";
import { SingleSearchCombo, MultiSearchCombo } from "@/components/search-combo";
import { DateRangeFilter } from "@/components/date-range-filter";
import { cn } from "@/lib/utils";
import { dateFieldForState, isFilterActive, type PaneFilter, type StateFilter } from "@/lib/filters";
import type { PaneView } from "@/lib/types";

const ISSUE_STATES: { id: StateFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

// PR view exposes "Merged" as a first-class state (GitHub lists merged PRs as closed).
const PR_STATES: { id: StateFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "merged", label: "Merged" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

// The date filter is contextual: it ranges over whichever timestamp fits the state.
const DATE_LABELS: Record<"createdAt" | "closedAt" | "mergedAt", string> = {
  createdAt: "Opened",
  closedAt: "Closed",
  mergedAt: "Merged",
};

interface Props {
  filter: PaneFilter;
  assignees: string[];
  repos: string[];
  statuses: string[];
  branches: string[];
  milestones: string[];
  showRepo: boolean;
  view: PaneView;
  matchCount: number;
  totalCount: number;
  onChange: (patch: Partial<PaneFilter>) => void;
  onClear: () => void;
}

export function PaneFilterBar({
  filter,
  assignees,
  repos,
  statuses,
  branches,
  milestones,
  showRepo,
  view,
  matchCount,
  totalCount,
  onChange,
  onClear,
}: Props) {
  const active = isFilterActive(filter);
  const states = view === "pulls" ? PR_STATES : ISSUE_STATES;
  const dateField = dateFieldForState(filter.state); // null on "all" → no date filter
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-2 py-1.5">
      <div className="flex shrink-0 overflow-hidden rounded border border-input">
        {states.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange({ state: s.id })}
            className={cn(
              "px-2 py-1 text-xs font-medium transition-colors",
              filter.state === s.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative min-w-[8rem] flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter.search}
          onChange={(e) => onChange({ search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          placeholder="Search title or #number…"
          className="h-7 pl-7 text-sm"
        />
      </div>

      {/* "User" = assignee for issues, author for pull requests (rowUsers). */}
      <SingleSearchCombo
        placeholder="All users"
        searchPlaceholder="Search users…"
        options={assignees.map((a) => ({ value: a, label: a }))}
        value={filter.assignees[0] ?? null}
        onChange={(v) => onChange({ assignees: v ? [v] : [] })}
        className="h-7 w-40"
      />

      {milestones.length > 0 && (
        <MultiSearchCombo
          placeholder="All milestones"
          searchPlaceholder="Search milestones…"
          options={milestones.map((m) => ({ value: m, label: m }))}
          selected={filter.milestones}
          onChange={(next) => onChange({ milestones: next })}
          className="h-7 w-44"
        />
      )}

      {dateField && (
        <DateRangeFilter
          label={DATE_LABELS[dateField]}
          value={filter.dateRange}
          onChange={(dateRange) => onChange({ dateRange })}
          className="w-44"
        />
      )}

      {view === "pulls" && branches.length > 0 && (
        <MultiSearchCombo
          placeholder="All branches"
          searchPlaceholder="Search branches…"
          options={branches.map((b) => ({ value: b, label: b }))}
          selected={filter.branches}
          onChange={(next) => onChange({ branches: next })}
          className="h-7 w-44"
        />
      )}

      {showRepo && (
        <MultiSearchCombo
          placeholder="All repos"
          searchPlaceholder="Search repos…"
          options={repos.map((r) => ({ value: r, label: r }))}
          selected={filter.repos}
          onChange={(next) => onChange({ repos: next })}
          className="h-7 w-40"
        />
      )}

      {statuses.length > 0 && (
        <MultiSelect
          placeholder="All statuses"
          options={statuses.map((s) => ({ value: s, label: s }))}
          selected={filter.statuses}
          onChange={(next) => onChange({ statuses: next })}
          className="max-w-[10rem]"
        />
      )}

      <span className={cn("shrink-0 font-mono text-xs tabular-nums", active ? "text-primary" : "text-muted-foreground")}>
        {active ? `${matchCount}/${totalCount}` : totalCount}
      </span>

      {active && (
        <button
          type="button"
          onClick={onClear}
          title="Clear filters"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
