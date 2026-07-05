import type { IssueRow, LastColumn, PaneSource, PaneView, PrStatus } from "@/lib/types";

/** open / closed / merged for a PR row (merged wins over the raw closed state). */
export function prStatus(row: IssueRow): PrStatus {
  return row.pr?.merged ? "merged" : row.state;
}

export function sourceLabel(s: PaneSource | null): string {
  if (!s) return "— no source —";
  if (s.kind === "repo") return s.repo;
  if (s.kind === "milestone") return `milestone: ${s.title}`;
  if (s.kind === "recent") return "recent issues";
  return s.projectTitle ?? `project #${s.projectNumber}`;
}

export function sourceKindLabel(s: PaneSource | null): string {
  if (!s) return "";
  if (s.kind === "repo") return "repo";
  if (s.kind === "milestone") return "milestone";
  if (s.kind === "recent") return "recent";
  return "project";
}

/** repo source -> "Milestone" column; milestone/project source -> "Repo" column. */
export function contextColumn(s: PaneSource | null): LastColumn {
  return s?.kind === "repo" ? "milestone" : "repo";
}

import type { StateFilter } from "@/lib/filters";

/** GitHub's pulls API has no "merged" list state — merged PRs are closed and filtered client-side. */
function pullsState(state: StateFilter): string {
  return state === "merged" ? "closed" : state === "all" ? "all" : state;
}

/** repo/milestone filter open/closed server-side; project Status is filtered client-side. */
export function sourceToQuery(
  s: PaneSource,
  state: StateFilter = "open",
  view: PaneView = "issues",
): Record<string, string> {
  if (s.kind === "repo") {
    if (view === "pulls") return { kind: "pulls", repo: s.repo, state: pullsState(state) };
    return { kind: "repo", repo: s.repo, state: state === "merged" ? "closed" : state };
  }
  if (s.kind === "milestone") return { kind: "milestone", title: s.title, state: state === "merged" ? "closed" : state };
  if (s.kind === "recent") return { kind: "recent", state: state === "merged" ? "closed" : state };
  return { kind: "project", projectNumber: String(s.projectNumber) };
}

/** Stable cache key for React Query, derived from the query params (includes state + view). */
export function sourceKey(s: PaneSource | null, state: StateFilter = "open", view: PaneView = "issues"): string {
  return s ? JSON.stringify(sourceToQuery(s, state, view)) : "none";
}
