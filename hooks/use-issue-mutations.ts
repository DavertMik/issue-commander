import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiRequestError } from "@/lib/api";
import { sourceKey } from "@/lib/source";
import { buildMoveBody } from "@/lib/transfer";
import { useAppStore } from "@/hooks/use-app-store";
import type { Assignee, IssueDetail, IssueRow, Label, PaneListResult, PaneSource } from "@/lib/types";

// Mark rows in-flight (spinner) and resolve to done/error (auto-clears after 5s).
const beginOps = (keys: string[]) => keys.forEach((k) => useAppStore.getState().beginOp(k));
const endOp = (key: string, ok: boolean) => useAppStore.getState().endOp(key, ok);

type IssuesData = InfiniteData<PaneListResult, string | undefined>;

function errMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

const keyOf = (r: IssueRow) => `${r.repo.name}#${r.number}`;

/** Milestone lists are backed by the eventually-consistent Search API. */
function isMilestoneQuery(key: readonly unknown[]): boolean {
  return key[0] === "issues" && typeof key[1] === "string" && key[1].includes('"kind":"milestone"');
}

/** The title a milestone pane is sourced by (so we can drop rows that no longer match it). */
function milestoneTitleFromKey(key: readonly unknown[]): string | null {
  if (key[0] !== "issues" || typeof key[1] !== "string") return null;
  try {
    const q = JSON.parse(key[1]) as { kind?: string; title?: string };
    return q.kind === "milestone" ? (q.title ?? null) : null;
  } catch {
    return null;
  }
}

/** Run `worker` over `items` with at most `limit` concurrent; returns the items that threw. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<T[]> {
  const failed: T[] = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try {
        await worker(item);
      } catch {
        failed.push(item);
      }
    }
  });
  await Promise.all(runners);
  return failed;
}

const plural = (n: number) => (n === 1 ? "" : "s");

/**
 * Optimistic mutations (single edit + bulk close/copy/move). Each updates the
 * affected source caches immediately, runs the API calls concurrently, rolls
 * back any that fail, and reconciles with a background refetch.
 */
export function useIssueActions() {
  const qc = useQueryClient();

  // Apply a per-page row transform across all loaded pages of a source's list.
  // Prefix match (["issues", sourceKey]) so it also covers the per-default-project key variant.
  function patchList(src: PaneSource | null, fn: (rows: IssueRow[]) => IssueRow[]): void {
    if (!src) return;
    qc.setQueriesData<IssuesData>({ queryKey: ["issues", sourceKey(src)] }, (prev) =>
      prev ? { ...prev, pages: prev.pages.map((p) => ({ ...p, rows: fn(p.rows) })) } : prev,
    );
  }

  // Batch-prepend rows to the first page (skipping any already present).
  function addMany(src: PaneSource | null, rows: IssueRow[]): void {
    if (!src || rows.length === 0) return;
    qc.setQueriesData<IssuesData>({ queryKey: ["issues", sourceKey(src)] }, (prev) => {
      if (!prev || prev.pages.length === 0) return prev;
      const existing = new Set(prev.pages.flatMap((p) => p.rows.map(keyOf)));
      const toAdd = rows.filter((r) => !existing.has(keyOf(r)));
      if (!toAdd.length) return prev;
      return { ...prev, pages: prev.pages.map((p, i) => (i === 0 ? { ...p, rows: [...toAdd, ...p.rows] } : p)) };
    });
  }

  // Re-insert rows that were optimistically removed but whose API call failed.
  function readd(src: PaneSource | null, failedRows: IssueRow[]): void {
    patchList(src, (rows) => {
      const present = new Set(rows.map(keyOf));
      const missing = failedRows.filter((r) => !present.has(keyOf(r)));
      return missing.length ? [...missing, ...rows] : rows;
    });
  }

  const removeKeys = (keys: Set<string>) => (rows: IssueRow[]) => rows.filter((r) => !keys.has(keyOf(r)));

  function reconcile() {
    // Only refetch strongly-consistent lists (repo/project). Milestone lists are Search-API-backed
    // and eventually consistent — the optimistic change is already confirmed by the API, so refetching
    // would only risk reverting it from a stale index. Leave the confirmed optimistic cache in place.
    qc.invalidateQueries({ queryKey: ["issues"], predicate: (q) => !isMilestoneQuery(q.queryKey) });
  }

  return {
    /** F4 — single inline body edit. */
    async edit(owner: string, repo: string, number: number, body: string): Promise<boolean> {
      const key = ["issueDetail", owner, repo, number] as const;
      const rowKey = `${repo}#${number}`;
      const prev = qc.getQueryData<IssueDetail>(key);
      if (prev) qc.setQueryData<IssueDetail>(key, { ...prev, body });
      beginOps([rowKey]);
      try {
        await api.patchIssue(owner, repo, number, { body });
        endOp(rowKey, true);
        toast.success(`Saved #${number}`);
        qc.invalidateQueries({ queryKey: key });
        return true;
      } catch (e) {
        if (prev) qc.setQueryData(key, prev);
        endOp(rowKey, false);
        toast.error(`Save failed: ${errMessage(e)}`);
        return false;
      }
    },

    /** F8 — close one or many issues. */
    async bulkClose(rows: IssueRow[], activeSource: PaneSource | null): Promise<void> {
      if (!rows.length) return;
      beginOps(rows.map(keyOf));
      patchList(activeSource, removeKeys(new Set(rows.map(keyOf))));
      const failed = await runPool(rows, 6, async (r) => {
        await api.patchIssue(r.repo.owner, r.repo.name, r.number, { state: "closed" });
      });
      const failedKeys = new Set(failed.map(keyOf));
      for (const r of rows) endOp(keyOf(r), !failedKeys.has(keyOf(r)));
      if (failed.length) {
        readd(activeSource, failed);
        toast.error(`Closed ${rows.length - failed.length}, ${failed.length} failed`);
      } else {
        toast.success(rows.length === 1 ? `Closed #${rows[0].number}` : `Closed ${rows.length} issues`);
      }
      reconcile();
    },

    /** F5 — copy one or many issues to a project board. */
    async bulkCopy(rows: IssueRow[], dest: PaneSource | null, onFlash?: (key: string) => void): Promise<void> {
      if (!rows.length || dest?.kind !== "project" || !dest.projectId) return;
      const projectId = dest.projectId;
      beginOps(rows.map(keyOf));
      addMany(dest, rows);
      const failed = await runPool(rows, 6, async (r) => {
        await api.copy({ issueNodeId: r.nodeId, targetProjectId: projectId });
        onFlash?.(keyOf(r));
      });
      const failedKeys = new Set(failed.map(keyOf));
      for (const r of rows) endOp(keyOf(r), !failedKeys.has(keyOf(r)));
      if (failed.length) {
        patchList(dest, removeKeys(new Set(failed.map(keyOf))));
        toast.error(`Copied ${rows.length - failed.length}, ${failed.length} failed`);
      } else {
        toast.success(`Copied ${rows.length} issue${plural(rows.length)} to project`);
      }
      reconcile();
    },

    /** F6 — move one or many issues onto the destination source. */
    async bulkMove(
      rows: IssueRow[],
      activeSource: PaneSource | null,
      dest: PaneSource | null,
      onFlash?: (key: string) => void,
    ): Promise<void> {
      if (!rows.length || !dest) return;
      beginOps(rows.map(keyOf));
      const keys = new Set(rows.map(keyOf));
      const removesFromSource =
        dest.kind === "repo" || dest.kind === "project" || (dest.kind === "milestone" && activeSource?.kind === "milestone");

      if (removesFromSource) {
        patchList(activeSource, removeKeys(keys));
      } else if (dest.kind === "milestone") {
        // active is a repo pane — reflect the new milestone in its column
        patchList(activeSource, (rs) =>
          rs.map((r) => (keys.has(keyOf(r)) ? { ...r, milestone: { number: null, title: dest.title } } : r)),
        );
      }
      if (dest.kind === "project") addMany(dest, rows);
      else if (dest.kind === "milestone") {
        addMany(dest, rows.map((r) => ({ ...r, milestone: { number: null, title: dest.title } })));
      }

      const failed = await runPool(rows, 5, async (r) => {
        const body = buildMoveBody(r, activeSource, dest);
        if (!body) throw new Error("ineligible");
        const res = await api.move(body);
        onFlash?.(res.mode === "repo" && res.newNumber && dest.kind === "repo" ? `${dest.repo}#${res.newNumber}` : keyOf(r));
      });

      const failedKeys = new Set(failed.map(keyOf));
      for (const r of rows) endOp(keyOf(r), !failedKeys.has(keyOf(r)));
      if (failed.length) {
        if (removesFromSource) readd(activeSource, failed);
        if (dest.kind === "project" || dest.kind === "milestone") patchList(dest, removeKeys(failedKeys));
        toast.error(`Moved ${rows.length - failed.length}, ${failed.length} failed`);
      } else {
        toast.success(`Moved ${rows.length} issue${plural(rows.length)}`);
      }
      reconcile();
    },

    /**
     * F7 quick-edit — apply all changed fields at once (Save). REST fields
     * (assignees/labels/milestone) go in one PATCH; project status is a separate
     * GraphQL mutation. Optimistic across every pane, with rollback.
     */
    async applyIssueEdit(args: {
      owner: string;
      repo: string;
      number: number;
      issueKey: string;
      state?: "open" | "closed"; // changed -> new state
      assignees?: Assignee[]; // changed -> new full set
      labels?: Label[]; // changed -> new full set
      milestone?: { number: number | null; title: string }; // changed -> new value (null = cleared)
      type?: string | null; // changed -> new Issue Type name (null = cleared)
      status?: { projectId: string; itemId: string; fieldId: string; optionId: string; optionName: string };
      reviewers?: { add: string[]; remove: string[] }; // pull-request review requests to add/withdraw
    }): Promise<boolean> {
      const restChanged =
        args.state !== undefined ||
        args.assignees !== undefined ||
        args.labels !== undefined ||
        args.milestone !== undefined ||
        args.type !== undefined;
      const reviewersChanged = !!args.reviewers && (args.reviewers.add.length > 0 || args.reviewers.remove.length > 0);
      if (!restChanged && !args.status && !reviewersChanged) return true;

      beginOps([args.issueKey]);
      const prev = qc.getQueriesData<IssuesData>({ queryKey: ["issues"] });

      const patchRow = (r: IssueRow): IssueRow => {
        const nr: IssueRow = { ...r };
        if (args.state !== undefined) nr.state = args.state;
        if (args.assignees !== undefined) nr.assignees = args.assignees;
        if (args.labels !== undefined) nr.labels = args.labels;
        if (args.milestone !== undefined) nr.milestone = args.milestone;
        if (args.type !== undefined) nr.type = args.type;
        if (args.status && r.projectStatus?.projectId === args.status.projectId) {
          nr.projectStatus = { ...r.projectStatus, status: args.status.optionName, optionId: args.status.optionId };
        }
        if (reviewersChanged && r.pr) {
          const { add, remove } = args.reviewers!;
          const next = r.pr.requestedReviewers.filter((x) => !remove.includes(x));
          for (const x of add) if (!next.includes(x)) next.push(x);
          nr.pr = { ...r.pr, requestedReviewers: next };
        }
        return nr;
      };

      // Apply per-query so a milestone pane can DROP the row when its milestone no longer matches
      // (the milestone is the pane's source, not a client filter — re-filter it here).
      for (const [key, data] of prev) {
        if (!data) continue;
        const msTitle = milestoneTitleFromKey(key);
        qc.setQueryData<IssuesData>(key, {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            rows: p.rows.flatMap((r) => {
              if (keyOf(r) !== args.issueKey) return [r];
              const nr = patchRow(r);
              if (msTitle !== null && (nr.milestone?.title ?? null) !== msTitle) return [];
              return [nr];
            }),
          })),
        });
      }

      try {
        if (restChanged) {
          await api.patchIssue(args.owner, args.repo, args.number, {
            ...(args.state !== undefined ? { state: args.state } : {}),
            ...(args.assignees !== undefined ? { assignees: args.assignees.map((a) => a.login) } : {}),
            ...(args.labels !== undefined ? { labels: args.labels.map((l) => l.name) } : {}),
            ...(args.milestone !== undefined ? { milestoneNumber: args.milestone.number } : {}),
            ...(args.type !== undefined ? { type: args.type } : {}),
          });
        }
        if (args.status) {
          await api.setStatus({
            projectId: args.status.projectId,
            itemId: args.status.itemId,
            fieldId: args.status.fieldId,
            optionId: args.status.optionId,
          });
        }
        if (reviewersChanged) {
          await api.setReviewers({
            owner: args.owner,
            repo: args.repo,
            number: args.number,
            add: args.reviewers!.add,
            remove: args.reviewers!.remove,
          });
        }
        endOp(args.issueKey, true);
        toast.success(`Saved #${args.number}`);
        // milestone/state changes can drop the issue from a milestone- or state-filtered list
        if (args.milestone !== undefined || args.state !== undefined) reconcile();
        return true;
      } catch (e) {
        for (const [key, data] of prev) qc.setQueryData(key, data);
        endOp(args.issueKey, false);
        toast.error(`Save failed: ${errMessage(e)}`);
        return false;
      }
    },

    /**
     * F7 bulk-edit — override the given fields on every selected issue. Only the fields present in
     * `changes` are applied. Optimistic across panes (incl. milestone re-filter), per-row spinner,
     * and failed rows are reverted to their pre-edit state.
     */
    async bulkEdit(
      rows: IssueRow[],
      changes: {
        state?: "open" | "closed";
        assignees?: Assignee[];
        milestone?: { title: string | null };
        status?: { projectId: string; fieldId: string; optionId: string; optionName: string };
      },
    ): Promise<void> {
      if (!rows.length) return;
      const keys = rows.map(keyOf);
      beginOps(keys);
      const prev = qc.getQueriesData<IssuesData>({ queryKey: ["issues"] });

      const patchRow = (r: IssueRow): IssueRow => {
        const nr: IssueRow = { ...r };
        if (changes.state) nr.state = changes.state;
        if (changes.assignees !== undefined) nr.assignees = changes.assignees;
        if (changes.milestone !== undefined) {
          nr.milestone = changes.milestone.title === null ? null : { number: null, title: changes.milestone.title };
        }
        if (changes.status && r.projectStatus?.projectId === changes.status.projectId) {
          nr.projectStatus = { ...r.projectStatus, status: changes.status.optionName, optionId: changes.status.optionId };
        }
        return nr;
      };

      const applyOptimistic = (targetKeys: Set<string>) => {
        for (const [key, data] of qc.getQueriesData<IssuesData>({ queryKey: ["issues"] })) {
          if (!data) continue;
          const msTitle = milestoneTitleFromKey(key);
          qc.setQueryData<IssuesData>(key, {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              rows: p.rows.flatMap((r) => {
                if (!targetKeys.has(keyOf(r))) return [r];
                const nr = patchRow(r);
                if (msTitle !== null && changes.milestone !== undefined && (nr.milestone?.title ?? null) !== msTitle) {
                  return [];
                }
                return [nr];
              }),
            })),
          });
        }
      };

      applyOptimistic(new Set(keys));

      const failed = await runPool(rows, 5, async (r) => {
        const patch: Parameters<typeof api.patchIssue>[3] = {};
        if (changes.state) patch.state = changes.state;
        if (changes.assignees !== undefined) patch.assignees = changes.assignees.map((a) => a.login);
        if (patch.state !== undefined || patch.assignees !== undefined) {
          await api.patchIssue(r.repo.owner, r.repo.name, r.number, patch);
        }
        if (changes.milestone !== undefined) {
          await api.move({ mode: "milestone", repo: r.repo.name, number: r.number, targetTitle: changes.milestone.title });
        }
        if (changes.status && r.projectStatus?.projectId === changes.status.projectId && r.projectStatus.itemId) {
          await api.setStatus({
            projectId: changes.status.projectId,
            itemId: r.projectStatus.itemId,
            fieldId: changes.status.fieldId,
            optionId: changes.status.optionId,
          });
        }
      });

      const failedKeys = new Set(failed.map(keyOf));
      for (const r of rows) endOp(keyOf(r), !failedKeys.has(keyOf(r)));

      if (failed.length) {
        // Revert everything, then re-apply only the rows that succeeded.
        for (const [key, data] of prev) qc.setQueryData(key, data);
        applyOptimistic(new Set(rows.filter((r) => !failedKeys.has(keyOf(r))).map(keyOf)));
        toast.error(`Updated ${rows.length - failed.length}, ${failed.length} failed`);
      } else {
        toast.success(`Updated ${rows.length} issue${plural(rows.length)}`);
      }
      reconcile();
    },
  };
}
