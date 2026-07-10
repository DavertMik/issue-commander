import type { IssueRow } from "@/lib/types";

// "merged" is a PR-view-only pseudo-state (GitHub lists merged PRs as closed); see sourceToQuery.
export type StateFilter = "open" | "closed" | "merged" | "all";
export type SortField = "none" | "number" | "title" | "repo" | "assignee" | "status" | "created";
export type SortDir = "asc" | "desc";

/** An inclusive local-date range (yyyy-mm-dd); either bound may be open. */
export interface DateRange {
  from: string | null; // inclusive start (yyyy-mm-dd), null = unbounded
  to: string | null; // inclusive end (yyyy-mm-dd), null = unbounded
}
export const emptyDateRange = (): DateRange => ({ from: null, to: null });

/** Which IssueRow timestamp the date filter ranges over, chosen by the active state. */
export type DateField = "createdAt" | "closedAt" | "mergedAt";

/** The date filter is contextual: opened-date for Open, closed-date for Closed,
 * merged-date for Merged. "All" mixes states, so no single date applies. */
export function dateFieldForState(state: StateFilter): DateField | null {
  if (state === "open") return "createdAt";
  if (state === "closed") return "closedAt";
  if (state === "merged") return "mergedAt";
  return null; // "all"
}

export interface PaneFilter {
  search: string;
  assignees: string[];
  repos: string[];
  statuses: string[];
  branches: string[]; // PR target (base) branches, PR view only
  milestones: string[]; // milestone titles
  state: StateFilter;
  dateRange: DateRange; // ranges over the state's contextual date (dateFieldForState)
  sortBy: SortField;
  sortDir: SortDir;
}

export const emptyFilter = (): PaneFilter => ({
  search: "",
  assignees: [],
  repos: [],
  statuses: [],
  branches: [],
  milestones: [],
  state: "open",
  dateRange: emptyDateRange(),
  sortBy: "none",
  sortDir: "asc",
});

/** True when the range constrains anything for the current state. "All" has no
 * contextual date, so a set range is inert there and shouldn't read as active. */
function isDateRangeActive(f: PaneFilter): boolean {
  return dateFieldForState(f.state) != null && !!(f.dateRange.from || f.dateRange.to);
}

/** Non-state filters that act purely client-side (state is also a server query param). */
export function isFilterActive(f: PaneFilter): boolean {
  return !!(
    f.search.trim() ||
    f.assignees.length ||
    f.repos.length ||
    f.statuses.length ||
    f.branches.length ||
    f.milestones.length ||
    isDateRangeActive(f)
  );
}

function rowDate(r: IssueRow, field: DateField): string | null {
  if (field === "mergedAt") return r.pr?.mergedAt ?? null;
  if (field === "closedAt") return r.closedAt;
  return r.createdAt;
}

/** The "User" facet of a row: assignees for issues, the author for pull requests. */
export function rowUsers(r: IssueRow): string[] {
  if (r.pr) return r.pr.author ? [r.pr.author.login] : [];
  return r.assignees.map((a) => a.login);
}

/** Epoch-ms bounds for a local-date range: [start-of-`from`, end-of-`to`]. */
function rangeBounds(range: DateRange): { fromMs: number | null; toMs: number | null } {
  const fromMs = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
  const toMs = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : null;
  return { fromMs, toMs };
}

/**
 * Client-side filter over a pane's loaded rows. Fields combine with AND;
 * multiple values within a field combine with OR.
 */
export function applyFilters(rows: IssueRow[], f: PaneFilter): IssueRow[] {
  let out = rows;
  // State: PR-aware but backward-compatible for issues (which have no `pr`).
  // "merged" matches merged PRs; "closed" excludes merged PRs; issues fall through unchanged.
  if (f.state === "open") out = out.filter((r) => r.state === "open");
  else if (f.state === "closed") out = out.filter((r) => r.state === "closed" && !r.pr?.merged);
  else if (f.state === "merged") out = out.filter((r) => !!r.pr?.merged);
  // "all" → no state filter
  const dateField = dateFieldForState(f.state);
  if (dateField && (f.dateRange.from || f.dateRange.to)) {
    const { fromMs, toMs } = rangeBounds(f.dateRange);
    out = out.filter((r) => {
      const d = rowDate(r, dateField);
      if (!d) return false; // no such date → excluded while a range is set
      const t = new Date(d).getTime();
      if (fromMs != null && t < fromMs) return false;
      if (toMs != null && t > toMs) return false;
      return true;
    });
  }
  if (f.assignees.length) {
    const set = new Set(f.assignees);
    out = out.filter((r) => rowUsers(r).some((login) => set.has(login)));
  }
  if (f.repos.length) {
    const set = new Set(f.repos);
    out = out.filter((r) => set.has(r.repo.name));
  }
  if (f.statuses.length) {
    const set = new Set(f.statuses);
    out = out.filter((r) => r.projectStatus?.status != null && set.has(r.projectStatus.status));
  }
  if (f.branches.length) {
    const set = new Set(f.branches);
    out = out.filter((r) => r.pr?.baseRef != null && set.has(r.pr.baseRef));
  }
  if (f.milestones.length) {
    const set = new Set(f.milestones);
    out = out.filter((r) => r.milestone?.title != null && set.has(r.milestone.title));
  }
  const q = f.search.trim().toLowerCase();
  if (q) {
    const num = q.replace(/^#/, "");
    out = out.filter((r) => r.title.toLowerCase().includes(q) || String(r.number).includes(num));
  }

  if (f.sortBy !== "none") {
    const dir = f.sortDir === "asc" ? 1 : -1;
    const firstAssignee = (r: IssueRow) => rowUsers(r)[0] ?? "";
    out = [...out].sort((a, b) => {
      switch (f.sortBy) {
        case "number":
          return (a.number - b.number) * dir;
        case "title":
          return a.title.localeCompare(b.title) * dir || (a.number - b.number);
        case "repo":
          return a.repo.name.localeCompare(b.repo.name) * dir || (a.number - b.number);
        case "assignee":
          return firstAssignee(a).localeCompare(firstAssignee(b)) * dir || (a.number - b.number);
        case "status":
          return (a.projectStatus?.status ?? "").localeCompare(b.projectStatus?.status ?? "") * dir || (a.number - b.number);
        case "created":
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir || (a.number - b.number);
        default:
          return 0;
      }
    });
  }
  return out;
}

/** Distinct "User" values across rows (assignees of issues, authors of PRs). */
export function distinctUsers(rows: IssueRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const login of rowUsers(r)) set.add(login);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function distinctRepos(rows: IssueRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(r.repo.name);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function distinctStatuses(rows: IssueRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.projectStatus?.status) set.add(r.projectStatus.status);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Distinct PR target (base) branches across loaded rows. */
export function distinctBranches(rows: IssueRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.pr?.baseRef) set.add(r.pr.baseRef);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function distinctMilestones(rows: IssueRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.milestone?.title) set.add(r.milestone.title);
  return [...set].sort((a, b) => a.localeCompare(b));
}
