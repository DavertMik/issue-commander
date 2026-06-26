import type { IssueRow } from "@/lib/types";

export type StateFilter = "open" | "closed" | "all";
export type SortField = "none" | "number" | "title" | "repo" | "assignee" | "status";
export type SortDir = "asc" | "desc";

export interface PaneFilter {
  search: string;
  assignees: string[];
  repos: string[];
  statuses: string[];
  state: StateFilter;
  sortBy: SortField;
  sortDir: SortDir;
}

export const emptyFilter = (): PaneFilter => ({
  search: "",
  assignees: [],
  repos: [],
  statuses: [],
  state: "open",
  sortBy: "none",
  sortDir: "asc",
});

/** Non-state filters that act purely client-side (state is also a server query param). */
export function isFilterActive(f: PaneFilter): boolean {
  return !!(f.search.trim() || f.assignees.length || f.repos.length || f.statuses.length);
}

/**
 * Client-side filter over a pane's loaded rows. Fields combine with AND;
 * multiple values within a field combine with OR.
 */
export function applyFilters(rows: IssueRow[], f: PaneFilter): IssueRow[] {
  let out = rows;
  if (f.state !== "all") out = out.filter((r) => r.state === f.state);
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
