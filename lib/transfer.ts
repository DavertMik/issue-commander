import type { IssueRow, PaneSource } from "@/lib/types";
import type { MoveBody } from "@/lib/validation/schemas";

/** Build the POST /api/actions/move body for moving `row` (from `source`) onto `dest`. */
export function buildMoveBody(row: IssueRow, source: PaneSource | null, dest: PaneSource): MoveBody | null {
  if (dest.kind === "repo") {
    return { mode: "repo", issueNodeId: row.nodeId, targetRepo: dest.repo };
  }
  if (dest.kind === "milestone") {
    return { mode: "milestone", repo: row.repo.name, number: row.number, targetTitle: dest.title };
  }
  if (dest.kind === "project" && source?.kind === "project" && source.projectId && dest.projectId && row.projectItemId) {
    return {
      mode: "project",
      issueNodeId: row.nodeId,
      sourceProjectId: source.projectId,
      sourceProjectItemId: row.projectItemId,
      targetProjectId: dest.projectId,
    };
  }
  return null;
}

export interface OpResult {
  ok: boolean;
  reason?: string;
  requiresConfirm?: boolean;
}

/** F5 copy — valid only when the destination pane is a Project board. */
export function canCopy(issue: IssueRow | null | undefined, dest: PaneSource | null): OpResult {
  if (!issue) return { ok: false, reason: "No issue selected" };
  if (!dest) return { ok: false, reason: "Other pane has no source" };
  if (dest.kind !== "project") return { ok: false, reason: "Copy target must be a Project board" };
  if (!dest.projectId) return { ok: false, reason: "Project id not resolved yet" };
  return { ok: true };
}

/**
 * F6 move:
 *  - dest repo      -> transfer (cross-repo, renumbers; requiresConfirm)
 *  - dest milestone -> reassign milestone (same repo only)
 *  - dest project   -> move between projects (source must also be a project; F5 adds otherwise)
 */
export function canMove(
  issue: IssueRow | null | undefined,
  source: PaneSource | null,
  dest: PaneSource | null,
): OpResult {
  if (!issue) return { ok: false, reason: "No issue selected" };
  if (!dest) return { ok: false, reason: "Other pane has no source" };

  if (dest.kind === "repo") {
    if (issue.repo.name === dest.repo) return { ok: false, reason: "Already in this repository" };
    return { ok: true, requiresConfirm: true };
  }

  if (dest.kind === "milestone") {
    // Org-wide milestone by title — assigning resolves the title within the
    // issue's own repo server-side (errors there if that repo lacks the title).
    if (issue.milestone?.title === dest.title) {
      return { ok: false, reason: "Already in this milestone" };
    }
    return { ok: true };
  }

  if (dest.kind === "recent") return { ok: false, reason: "Recent issues isn't a move target" };

  // dest.kind === "project"
  if (source?.kind !== "project") {
    return { ok: false, reason: "Use F5 to add to a project — F6 moves only between projects" };
  }
  if (source.projectNumber === dest.projectNumber) return { ok: false, reason: "Already in this project" };
  if (!issue.projectItemId || !source.projectId || !dest.projectId) {
    return { ok: false, reason: "Project ids not resolved yet" };
  }
  return { ok: true };
}
