import type { IssueRow } from "@/lib/types";

// "merged" is a PR-view-only pseudo-state (GitHub lists merged PRs as closed); see sourceToQuery.
export type StateFilter = "open" | "closed" | "merged" | "all";
export type SortField = "none" | "number" | "title" | "repo" | "assignee" | "status";
export type SortDir = "asc" | "desc";
/** PR merged-at range filter (client-side, PR view only). */
export type MergedRange = "any" | "today" | "week" | "month";

export interface PaneFilter {
  search: string;
  assignees: string[];
  repos: string[];
  statuses: string[];
  branches: string[]; // PR target (base) branches, PR view only
  state: StateFilter;
  mergedRange: MergedRange;
  sortBy: SortField;
  sortDir: SortDir;
}

export const emptyFilter = (): PaneFilter => ({
  search: "",
  assignees: [],
  repos: [],
  statuses: [],
  branches: [],
  state: "open",
  mergedRange: "any",
  sortBy: "none",
  sortDir: "asc",
});

/** Non-state filters that act purely client-side (state is also a server query param). */
export function isFilterActive(f: PaneFilter): boolean {
  return !!(
    f.search.trim() ||
    f.assignees.length ||
    f.repos.length ||
    f.statuses.length ||
    f.branches.length ||
    f.mergedRange !== "any"
  );
}

/** Epoch-ms cutoff for a merged-range filter, or null for "any". */
function mergedCutoff(range: MergedRange): number | null {
  if (range === "any") return null;
  const now = new Date();
  if (range === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.getTime();
  }
  const days = range === "week" ? 7 : 30; // rolling window
  return now.getTime() - days * 24 * 60 * 60 * 1000;
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
  const cutoff = mergedCutoff(f.mergedRange);
  if (cutoff != null) {
    out = out.filter((r) => r.pr?.mergedAt != null && new Date(r.pr.mergedAt).getTime() >= cutoff);
  }
  if (f.assignees.length) {
    const set = new Set(f.assignees);
    out = out.filter((r) => r.assignees.some((a) => set.has(a.login)));
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
  const q = f.search.trim().toLowerCase();
  if (q) {
    const num = q.replace(/^#/, "");
    out = out.filter((r) => r.title.toLowerCase().includes(q) || String(r.number).includes(num));
  }

  if (f.sortBy !== "none") {
    const dir = f.sortDir === "asc" ? 1 : -1;
    const firstAssignee = (r: IssueRow) => r.assignees[0]?.login ?? "";
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
        default:
          return 0;
      }
    });
  }
  return out;
}

export function distinctAssignees(rows: IssueRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const a of r.assignees) set.add(a.login);
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
