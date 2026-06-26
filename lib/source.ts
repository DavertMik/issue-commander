import type { LastColumn, PaneSource } from "@/lib/types";

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

/** repo/milestone filter open/closed server-side; project Status is filtered client-side. */
export function sourceToQuery(s: PaneSource, state: StateFilter = "open"): Record<string, string> {
  if (s.kind === "repo") return { kind: "repo", repo: s.repo, state };
  if (s.kind === "milestone") return { kind: "milestone", title: s.title, state };
  if (s.kind === "recent") return { kind: "recent", state };
  return { kind: "project", projectNumber: String(s.projectNumber) };
}

/** Stable cache key for React Query, derived from the query params (includes state). */
export function sourceKey(s: PaneSource | null, state: StateFilter = "open"): string {
  return s ? JSON.stringify(sourceToQuery(s, state)) : "none";
}
