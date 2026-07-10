"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SingleSearchCombo, MultiSearchCombo } from "@/components/search-combo";
import { useAppStore } from "@/hooks/use-app-store";
import { useRepoOptions } from "@/hooks/use-repo-options";
import { useIssueTypes, useMilestones } from "@/hooks/use-sources";
import { useStatusField } from "@/hooks/use-status";
import { useIssueActions } from "@/hooks/use-issue-mutations";
import type { IssueRow } from "@/lib/types";

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring";

function setEq(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type SaveRef = React.RefObject<(() => void) | null>;

function EditBody({ row, onClose, saveRef }: { row: IssueRow; onClose: () => void; saveRef: SaveRef }) {
  const actions = useIssueActions();
  const repoOpts = useRepoOptions(row.repo.name);
  const issueTypes = useIssueTypes(true);
  const statusField = useStatusField(row.projectStatus?.projectId ?? null);
  // Combobox popups portal here (inside the dialog) so interacting with them doesn't dismiss the modal.
  const popupContainer = useRef<HTMLDivElement>(null);

  // Pull requests reuse this dialog: state/assignee/labels/milestone all apply, plus PR-only
  // reviewers. Type doesn't apply to PRs, and the author can't be requested as a reviewer.
  const isPr = !!row.pr;
  const prAuthor = row.pr?.author?.login ?? null;

  const initState = row.state;
  const initType = row.type ?? null;
  const initAssignee = row.assignees[0]?.login ?? null;
  const initLabels = row.labels.map((l) => l.name);
  const initMilestone = row.milestone?.number ?? null;
  const initStatus = row.projectStatus?.optionId ?? null;
  const initReviewers = row.pr?.requestedReviewers ?? [];

  const [state, setState] = useState<"open" | "closed">(initState);
  const [type, setType] = useState<string | null>(initType);
  const [assignee, setAssignee] = useState<string | null>(initAssignee);
  const [labels, setLabels] = useState(() => new Set(initLabels));
  const [milestoneNumber, setMilestoneNumber] = useState<number | null>(initMilestone);
  const [statusOptionId, setStatusOptionId] = useState<string | null>(initStatus);
  const [reviewers, setReviewers] = useState(() => new Set(initReviewers));

  const issueKey = `${row.repo.name}#${row.number}`;
  const typeOptions = [...new Set([...(issueTypes.data ?? []), ...(initType ? [initType] : [])])];
  // Requestable reviewers = the repo's assignable users minus the PR author, plus anyone already
  // requested (so their removable chip renders even if they're outside the paginated assignee list).
  const reviewerOptions = [
    ...new Set([
      ...(repoOpts.data?.assignees ?? []).map((a) => a.login).filter((l) => l !== prAuthor),
      ...initReviewers,
    ]),
  ].map((login) => ({ value: login, label: login }));

  const reviewersDirty = isPr && !setEq(reviewers, new Set(initReviewers));
  const dirty =
    state !== initState ||
    type !== initType ||
    assignee !== initAssignee ||
    !setEq(labels, new Set(initLabels)) ||
    milestoneNumber !== initMilestone ||
    statusOptionId !== initStatus ||
    reviewersDirty;

  // Optimistic save: fire the change and close immediately; the cache updates instantly
  // and rolls back with a toast if the request fails.
  function save() {
    if (!dirty) {
      onClose();
      return;
    }
    const payload: Parameters<typeof actions.applyIssueEdit>[0] = {
      owner: row.repo.owner,
      repo: row.repo.name,
      number: row.number,
      issueKey,
    };
    if (state !== initState) payload.state = state;
    if (type !== initType) payload.type = type;
    if (assignee !== initAssignee) {
      payload.assignees = assignee ? (repoOpts.data?.assignees ?? []).filter((a) => a.login === assignee) : [];
    }
    if (!setEq(labels, new Set(initLabels))) {
      payload.labels = (repoOpts.data?.labels ?? []).filter((l) => labels.has(l.name));
    }
    if (milestoneNumber !== initMilestone) {
      const title = repoOpts.data?.milestones.find((m) => m.number === milestoneNumber)?.title ?? "";
      payload.milestone = { number: milestoneNumber, title };
    }
    if (statusOptionId !== initStatus && statusOptionId && row.projectStatus && statusField.data) {
      const opt = statusField.data.options.find((o) => o.id === statusOptionId);
      if (opt) {
        payload.status = {
          projectId: row.projectStatus.projectId,
          itemId: row.projectStatus.itemId,
          fieldId: statusField.data.fieldId,
          optionId: statusOptionId,
          optionName: opt.name,
        };
      }
    }
    if (reviewersDirty) {
      const initSet = new Set(initReviewers);
      payload.reviewers = {
        add: [...reviewers].filter((r) => !initSet.has(r)),
        remove: initReviewers.filter((r) => !reviewers.has(r)),
      };
    }
    void actions.applyIssueEdit(payload);
    onClose();
  }

  // Expose latest save() to the dialog-level Ctrl/Cmd+Enter handler.
  useEffect(() => {
    saveRef.current = save;
  });

  return (
    <div ref={popupContainer}>
      <div className="space-y-3 px-4 pb-2 pt-1">
        <Field label="State">
          <select className={selectCls} value={state} onChange={(e) => setState(e.target.value as "open" | "closed")}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </Field>

        {!isPr && typeOptions.length > 0 && (
          <Field label="Type">
            <select className={selectCls} value={type ?? ""} onChange={(e) => setType(e.target.value || null)}>
              <option value="">No type</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        )}

        {row.projectStatus && (
          <Field label="Status">
            <select className={selectCls} value={statusOptionId ?? ""} onChange={(e) => setStatusOptionId(e.target.value || null)}>
              {statusOptionId === null && <option value="">— select —</option>}
              {statusField.data?.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Milestone">
          <select
            className={selectCls}
            value={milestoneNumber ?? ""}
            onChange={(e) => setMilestoneNumber(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">No milestone</option>
            {repoOpts.data?.milestones.map((m) => (
              <option key={m.number} value={m.number}>
                {m.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assignee">
          <SingleSearchCombo
            placeholder="Unassigned"
            searchPlaceholder="Search users…"
            options={(repoOpts.data?.assignees ?? []).map((a) => ({ value: a.login, label: a.login }))}
            value={assignee}
            onChange={setAssignee}
            container={popupContainer}
          />
        </Field>

        <Field label="Labels">
          <MultiSearchCombo
            chips
            placeholder="Add labels…"
            searchPlaceholder="Search labels…"
            options={(repoOpts.data?.labels ?? []).map((l) => ({ value: l.name, label: l.name, color: l.color }))}
            selected={[...labels]}
            onChange={(next) => setLabels(new Set(next))}
            container={popupContainer}
          />
        </Field>

        {isPr && (
          <Field label="Reviewers">
            <MultiSearchCombo
              chips
              placeholder="Request reviews…"
              searchPlaceholder="Search users…"
              options={reviewerOptions}
              selected={[...reviewers]}
              onChange={(next) => setReviewers(new Set(next))}
              container={popupContainer}
            />
          </Field>
        )}
      </div>

      <DialogFooter className="gap-2 border-t border-border bg-muted/20 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty}>
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

const NO_CHANGE = ""; // sentinel for bulk-edit dropdowns: leave the field untouched

function BulkEditBody({ rows, onClose, saveRef }: { rows: IssueRow[]; onClose: () => void; saveRef: SaveRef }) {
  const actions = useIssueActions();
  const repoOpts = useRepoOptions(rows[0].repo.name); // assignee options from the first selected repo
  const milestones = useMilestones(true); // org-wide titles
  const projectIds = Array.from(new Set(rows.map((r) => r.projectStatus?.projectId).filter(Boolean))) as string[];
  const sharedProjectId = projectIds.length === 1 ? projectIds[0] : null;
  const statusField = useStatusField(sharedProjectId);

  const [state, setState] = useState(NO_CHANGE);
  const [milestone, setMilestone] = useState(NO_CHANGE); // "" | "__clear__" | title
  const [assignee, setAssignee] = useState(NO_CHANGE); // "" | "__unassign__" | login
  const [status, setStatus] = useState(NO_CHANGE); // "" | optionId

  const dirty = !!(state || milestone || assignee || status);

  function save() {
    const changes: Parameters<typeof actions.bulkEdit>[1] = {};
    if (state) changes.state = state as "open" | "closed";
    if (milestone) changes.milestone = { title: milestone === "__clear__" ? null : milestone };
    if (assignee) {
      changes.assignees =
        assignee === "__unassign__" ? [] : (repoOpts.data?.assignees ?? []).filter((a) => a.login === assignee);
    }
    if (status && sharedProjectId && statusField.data) {
      const opt = statusField.data.options.find((o) => o.id === status);
      if (opt) {
        changes.status = { projectId: sharedProjectId, fieldId: statusField.data.fieldId, optionId: status, optionName: opt.name };
      }
    }
    if (Object.keys(changes).length) void actions.bulkEdit(rows, changes);
    onClose();
  }

  useEffect(() => {
    saveRef.current = save;
  });

  return (
    <div>
      <div className="space-y-3 px-4 pb-2 pt-1">
        <p className="text-xs text-muted-foreground">Set only the fields you want to override on all selected issues.</p>

        <Field label="State">
          <select className={selectCls} value={state} onChange={(e) => setState(e.target.value)}>
            <option value={NO_CHANGE}>— no change —</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </Field>

        <Field label="Milestone">
          <select className={selectCls} value={milestone} onChange={(e) => setMilestone(e.target.value)}>
            <option value={NO_CHANGE}>— no change —</option>
            <option value="__clear__">No milestone</option>
            {milestones.data?.map((m) => (
              <option key={m.title} value={m.title}>
                {m.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assignee">
          <select className={selectCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value={NO_CHANGE}>— no change —</option>
            <option value="__unassign__">Unassigned</option>
            {repoOpts.data?.assignees.map((a) => (
              <option key={a.login} value={a.login}>
                {a.login}
              </option>
            ))}
          </select>
        </Field>

        {sharedProjectId && (
          <Field label="Status">
            <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value={NO_CHANGE}>— no change —</option>
              {statusField.data?.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <DialogFooter className="gap-2 border-t border-border bg-muted/20 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty}>
          Apply to {rows.length}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function EditDialog() {
  const targets = useAppStore((s) => s.editTargets);
  const close = useAppStore((s) => s.closeEdit);
  const single = targets && targets.length === 1 ? targets[0] : null;
  const bulk = targets && targets.length > 1 ? targets : null;
  // Capture phase so Ctrl/Cmd+Enter saves regardless of which control is focused (even an open combobox).
  const saveRef = useRef<(() => void) | null>(null);

  return (
    <Dialog open={!!targets} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="flex w-[28rem] max-w-[calc(100vw-2rem)] flex-col gap-0 p-0"
        onKeyDownCapture={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            saveRef.current?.();
          }
        }}
      >
        <DialogHeader className="min-w-0 px-4 pb-2 pt-4">
          <DialogTitle className="text-sm">
            {bulk ? `Edit ${bulk.length} issues` : single ? `Edit · ${single.repo.name}#${single.number}` : "Edit"}
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            {bulk ? "Override fields across the selection" : single?.title}
          </DialogDescription>
        </DialogHeader>
        {single && <EditBody key={`${single.repo.name}#${single.number}`} row={single} onClose={close} saveRef={saveRef} />}
        {bulk && (
          <BulkEditBody
            key={bulk.map((r) => `${r.repo.name}#${r.number}`).join(",")}
            rows={bulk}
            onClose={close}
            saveRef={saveRef}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
