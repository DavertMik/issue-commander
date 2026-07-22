"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DATE_PRESETS, summarizeRange } from "@/components/date-range-filter";
import { useAppStore, type PaneId } from "@/hooks/use-app-store";
import { useViewer } from "@/hooks/use-sources";
import {
  applyFilters,
  dateFieldForState,
  distinctBranches,
  distinctMilestones,
  distinctRepos,
  distinctStatuses,
  distinctUsers,
  emptyDateRange,
  emptyFilter,
  isFilterActive,
  sanitizeFilter,
  type DateRange,
  type PaneFilter,
  type StateFilter,
} from "@/lib/filters";
import { cn } from "@/lib/utils";
import type { IssueRow, LastColumn, PaneView } from "@/lib/types";

/**
 * The F / `/` filter dialog — a fully keyboard-driven view of the pane filter bar.
 * Each row has a single-letter hotkey that opens its dropdown; Tab moves between
 * rows; Enter applies; Esc cancels. Edits stay in a local draft (with a live match
 * count) and hit the store only on apply.
 */

type RowKey = "type" | "state" | "user" | "milestone" | "status" | "repo" | "branch" | "date";

const ROW_LETTER: Record<RowKey, string> = {
  type: "t",
  state: "s",
  user: "u", // assignee for issues, author for pull requests (rowUsers)
  milestone: "m",
  status: "p", // "s" belongs to open/closed State; the Project status column gets P
  repo: "r",
  branch: "b",
  date: "d",
};

const ISSUE_STATES: { value: StateFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];
const PR_STATES: { value: StateFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "merged", label: "Merged" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];
const DATE_LABELS = { createdAt: "Opened", closedAt: "Closed", mergedAt: "Merged" } as const;

const ANYTIME = "__anytime__";
const ANYONE = "__anyone__";

/** Row hotkey chip, styled like the F-key chips in the footer. */
function Kbd({ children }: { children: string }) {
  return (
    <kbd className="flex h-5 min-w-5 items-center justify-center rounded bg-primary px-1 font-mono text-[11px] font-bold text-primary-foreground">
      {children.toUpperCase()}
    </kbd>
  );
}

interface Option {
  value: string;
  label: string;
  checked?: boolean;
}

/** One filter row: kbd-labeled trigger + a cmdk dropdown. `multi` keeps the popup open on toggle. */
function FilterRow({
  letter,
  label,
  display,
  hasValue,
  open,
  onOpenChange,
  options,
  onPick,
  multi = false,
  searchable = false,
  searchPlaceholder = "Search…",
  triggerRef,
}: {
  letter: string;
  label: string;
  display: string;
  hasValue: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: Option[];
  onPick: (value: string) => void;
  multi?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
      <span className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
        <Kbd>{letter}</Kbd>
        {label}
      </span>
      {/* modal — inside a Radix Dialog the popover needs its own focus/dismiss layer */}
      <Popover modal open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger
          ref={triggerRef}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30",
            hasValue ? "border-primary/50 text-foreground" : "border-input text-muted-foreground",
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          data-filter-popup
          align="start"
          className="w-64 p-0"
          // Focus the search input when there is one, else the cmdk root itself so ↑/↓/Enter work.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const root = e.target as HTMLElement;
            (root.querySelector<HTMLElement>("[cmdk-input]") ?? root.querySelector<HTMLElement>("[cmdk-root]"))?.focus();
          }}
        >
          <Command tabIndex={-1} className="bg-transparent outline-none">
            {searchable && <CommandInput placeholder={searchPlaceholder} />}
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.value} value={o.label} onSelect={() => onPick(o.value)}>
                    <span className="truncate">{o.label}</span>
                    {(multi ? o.checked : o.checked ?? false) && <Check className="ml-auto size-4 shrink-0 text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function multiSummary(selected: string[], noun: string): string {
  if (selected.length === 0) return `All ${noun}`;
  if (selected.length <= 2) return selected.join(", ");
  return `${selected.length} selected`;
}

function FilterBody({
  pane,
  focusSearch,
  allRows,
  lastColumn,
  onClose,
}: {
  pane: PaneId;
  focusSearch: boolean;
  allRows: IssueRow[];
  lastColumn: LastColumn;
  onClose: () => void;
}) {
  const view = useAppStore((s) => s.panes[pane].view);
  const sourceKind = useAppStore((s) => s.panes[pane].source?.kind);
  const filter = useAppStore((s) => s.filters[pane]);
  const setFilter = useAppStore((s) => s.setFilter);
  const setView = useAppStore((s) => s.setView);
  const viewer = useViewer(true);

  // Mounted per open (see FilterDialog), so state initializes fresh from the store.
  const [draft, setDraft] = useState<PaneFilter>(filter);
  const [draftView, setDraftView] = useState<PaneView>(view);
  const [openRow, setOpenRow] = useState<RowKey | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);

  const isPulls = draftView === "pulls";
  const me = viewer.data ?? null;

  // Option lists come from the pane's currently loaded rows (same as the filter bar).
  const users = useMemo(() => distinctUsers(allRows), [allRows]);
  const repos = useMemo(() => distinctRepos(allRows), [allRows]);
  const statuses = useMemo(() => distinctStatuses(allRows), [allRows]);
  const branches = useMemo(() => distinctBranches(allRows), [allRows]);
  const milestones = useMemo(() => distinctMilestones(allRows), [allRows]);

  const dateField = dateFieldForState(draft.state);
  const visible: Record<RowKey, boolean> = {
    type: sourceKind === "repo",
    state: true,
    user: true,
    // A milestone pane's rows all share one title — the filter would be a no-op there.
    milestone: sourceKind !== "milestone" && milestones.length > 0,
    status: !isPulls && statuses.length > 0,
    repo: lastColumn === "repo",
    branch: view === "pulls" && branches.length > 0,
    date: dateField != null,
  };

  // Live match count on the draft; meaningless when the Type row switches views
  // (those rows aren't loaded yet), so it goes blank until applied.
  const matches = useMemo(() => applyFilters(allRows, draft).length, [allRows, draft]);
  const countValid = draftView === view;

  function apply() {
    if (draftView !== view) setView(pane, draftView);
    // The draft may have been built in the PR view — drop PR-only facets for Issues.
    setFilter(pane, sanitizeFilter(draft, draftView));
    onClose();
  }

  function clearAll() {
    setDraft(emptyFilter());
    setDraftView(view);
  }

  useEffect(() => {
    // After the Radix portal settles: `/` lands in search, `f` on the first row so
    // the letter keys work immediately (they're inert while an input has focus).
    const t = setTimeout(() => {
      if (focusSearch) searchRef.current?.focus();
      else firstRowRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [focusSearch]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const inPopup = !!target.closest("[data-filter-popup]");
    if (e.key === "Enter") {
      if (inPopup) return; // cmdk owns Enter there (picks the highlighted option)
      e.preventDefault();
      apply();
      return;
    }
    // Letters only act outside inputs (search box / dropdown search type normally).
    if (inPopup || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    const k = e.key.toLowerCase();
    if (e.key === "/") {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (k === "x") {
      e.preventDefault();
      clearAll();
      return;
    }
    const row = (Object.keys(ROW_LETTER) as RowKey[]).find((r) => ROW_LETTER[r] === k && visible[r]);
    if (row) {
      e.preventDefault();
      setOpenRow(row);
    }
  };

  const rowProps = (key: RowKey) => ({
    letter: ROW_LETTER[key],
    open: openRow === key,
    onOpenChange: (o: boolean) => setOpenRow(o ? key : null),
  });

  const user = draft.assignees[0] ?? null;
  const userOptions: Option[] = [
    { value: ANYONE, label: "Anyone", checked: user === null },
    ...(me ? [{ value: me, label: `@me (${me})`, checked: user === me }] : []),
    ...users.filter((u) => u !== me).map((u) => ({ value: u, label: u, checked: user === u })),
  ];

  const rangeEq = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to;
  const hasRange = !!(draft.dateRange.from || draft.dateRange.to);
  const dateOptions: Option[] = [
    { value: ANYTIME, label: "Anytime", checked: !hasRange },
    ...DATE_PRESETS.map((p) => ({ value: p.label, label: p.label, checked: rangeEq(draft.dateRange, p.range()) })),
  ];

  const draftActive = isFilterActive(draft) || draft.state !== "open" || draftView !== view;

  return (
    <div onKeyDown={onKeyDown}>
      <DialogHeader className="px-5 pb-3 pt-4">
        <DialogTitle className="text-sm">Filter · {pane === "pane1" ? "left" : "right"} pane</DialogTitle>
        <DialogDescription className="text-xs">
          Press a key to open a row · Enter to apply · Esc to cancel
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 px-5 pb-4">
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
          <span className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
            <Kbd>/</Kbd>
            Search
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={draft.search}
              onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
              placeholder="Title or #number…"
              className={cn("h-9 pl-8 text-sm", draft.search.trim() && "border-primary/50")}
            />
          </div>
        </div>

        {visible.type && (
          <FilterRow
            {...rowProps("type")}
            label="Type"
            display={isPulls ? "Pull Requests" : "Issues"}
            hasValue
            triggerRef={firstRowRef}
            options={[
              { value: "issues", label: "Issues", checked: !isPulls },
              { value: "pulls", label: "Pull Requests", checked: isPulls },
            ]}
            onPick={(v) => {
              const next = v as PaneView;
              setDraftView(next);
              // "merged" is a PR-only pseudo-state — coerce it away when leaving the PR view.
              if (next === "issues" && draft.state === "merged") setDraft((d) => ({ ...d, state: "open" }));
              setOpenRow(null);
            }}
          />
        )}

        <FilterRow
          {...rowProps("state")}
          label="State"
          display={(isPulls ? PR_STATES : ISSUE_STATES).find((s) => s.value === draft.state)?.label ?? draft.state}
          hasValue={draft.state !== "all"}
          triggerRef={visible.type ? undefined : firstRowRef}
          options={(isPulls ? PR_STATES : ISSUE_STATES).map((s) => ({
            value: s.value,
            label: s.label,
            checked: draft.state === s.value,
          }))}
          onPick={(v) => {
            setDraft((d) => ({ ...d, state: v as StateFilter }));
            setOpenRow(null);
          }}
        />

        <FilterRow
          {...rowProps("user")}
          label="User"
          display={user ? (user === me ? `@me (${me})` : user) : "Anyone"}
          hasValue={user !== null}
          searchable
          searchPlaceholder="Search users…"
          options={userOptions}
          onPick={(v) => {
            setDraft((d) => ({ ...d, assignees: v === ANYONE ? [] : [v] }));
            setOpenRow(null);
          }}
        />

        {visible.milestone && (
          <FilterRow
            {...rowProps("milestone")}
            label="Milestone"
            display={multiSummary(draft.milestones, "milestones")}
            hasValue={draft.milestones.length > 0}
            multi
            searchable
            searchPlaceholder="Search milestones…"
            options={milestones.map((m) => ({ value: m, label: m, checked: draft.milestones.includes(m) }))}
            onPick={(v) => setDraft((d) => ({ ...d, milestones: toggleIn(d.milestones, v) }))}
          />
        )}

        {visible.status && (
          <FilterRow
            {...rowProps("status")}
            label="Status"
            display={multiSummary(draft.statuses, "statuses")}
            hasValue={draft.statuses.length > 0}
            multi
            options={statuses.map((s) => ({ value: s, label: s, checked: draft.statuses.includes(s) }))}
            onPick={(v) => setDraft((d) => ({ ...d, statuses: toggleIn(d.statuses, v) }))}
          />
        )}

        {visible.repo && (
          <FilterRow
            {...rowProps("repo")}
            label="Repo"
            display={multiSummary(draft.repos, "repos")}
            hasValue={draft.repos.length > 0}
            multi
            searchable
            searchPlaceholder="Search repos…"
            options={repos.map((r) => ({ value: r, label: r, checked: draft.repos.includes(r) }))}
            onPick={(v) => setDraft((d) => ({ ...d, repos: toggleIn(d.repos, v) }))}
          />
        )}

        {visible.branch && (
          <FilterRow
            {...rowProps("branch")}
            label="Branch"
            display={multiSummary(draft.branches, "branches")}
            hasValue={draft.branches.length > 0}
            multi
            searchable
            searchPlaceholder="Search branches…"
            options={branches.map((b) => ({ value: b, label: b, checked: draft.branches.includes(b) }))}
            onPick={(v) => setDraft((d) => ({ ...d, branches: toggleIn(d.branches, v) }))}
          />
        )}

        {visible.date && dateField && (
          <FilterRow
            {...rowProps("date")}
            label={DATE_LABELS[dateField]}
            display={summarizeRange(DATE_LABELS[dateField], draft.dateRange)}
            hasValue={hasRange}
            options={dateOptions}
            onPick={(v) => {
              const preset = DATE_PRESETS.find((p) => p.label === v);
              setDraft((d) => ({ ...d, dateRange: preset ? preset.range() : emptyDateRange() }));
              setOpenRow(null);
            }}
          />
        )}
      </div>

      <DialogFooter className="items-center gap-1.5 border-t border-border bg-muted/20 px-5 py-3 sm:justify-end">
        <span
          className={cn(
            "mr-auto font-mono text-xs tabular-nums",
            draftActive && countValid ? "text-primary" : "text-muted-foreground",
          )}
        >
          {countValid ? `${matches}/${allRows.length} match` : "count after apply"}
        </span>
        <Button variant="ghost" size="sm" onClick={clearAll} disabled={!draftActive} title="Clear all filters (X)">
          Clear
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={apply}>
          Apply <span className="-mr-0.5 opacity-60">↵</span>
        </Button>
      </DialogFooter>
    </div>
  );
}

export function FilterDialog({
  rowsByPane,
  lastColumnByPane,
}: {
  rowsByPane: Record<PaneId, IssueRow[]>;
  lastColumnByPane: Record<PaneId, LastColumn>;
}) {
  const target = useAppStore((s) => s.filterDialog);
  const close = useAppStore((s) => s.closeFilterDialog);
  // Warm the viewer login at app start so "@me" is pinned from the first open.
  useViewer(true);

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="w-[30rem] max-w-[calc(100vw-2rem)] gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {target && (
          <FilterBody
            pane={target.pane}
            focusSearch={target.focusSearch}
            allRows={rowsByPane[target.pane]}
            lastColumn={lastColumnByPane[target.pane]}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
