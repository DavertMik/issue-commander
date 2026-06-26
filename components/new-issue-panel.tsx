"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SingleSearchCombo, MultiSearchCombo } from "@/components/search-combo";
import { useAppStore } from "@/hooks/use-app-store";
import { useIssueTypes, useMilestones, useProjects, useRepos } from "@/hooks/use-sources";
import { useRepoOptions } from "@/hooks/use-repo-options";
import { api } from "@/lib/api";

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Rendered inside the sibling pane (mode "new"). Prefilled synchronously from the active pane's filter/source + defaults. */
export function NewIssueForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const repos = useRepos(true);
  const projects = useProjects(true);
  const milestones = useMilestones(true);
  const issueTypes = useIssueTypes(true);

  // Snapshot the active (triggering) pane's filter/source + saved defaults once, at open.
  // Milestone is an org-wide title and project a number — both known here, no extra fetch needed.
  const initial = useMemo(() => {
    const s = useAppStore.getState();
    const filter = s.filters[s.active];
    const src = s.panes[s.active].source;
    const cfg = s.config;
    return {
      repo:
        filter.repos[0] ??
        (src?.kind === "repo" ? src.repo : null) ??
        s.newIssueRepoHint ??
        cfg.defaultRepository,
      assignee: filter.assignees[0] ?? null,
      milestoneTitle: (src?.kind === "milestone" ? src.title : cfg.defaultMilestone) ?? null,
      projectNumber: src?.kind === "project" ? src.projectNumber : cfg.defaultProject,
    };
  }, []);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [repo, setRepo] = useState<string | null>(initial.repo);
  const [assignee, setAssignee] = useState<string | null>(initial.assignee);
  const [labels, setLabels] = useState<string[]>([]);
  const [milestoneTitle, setMilestoneTitle] = useState<string | null>(initial.milestoneTitle);
  const [projectNumber, setProjectNumber] = useState<string | null>(
    initial.projectNumber != null ? String(initial.projectNumber) : null,
  );
  const [submitting, setSubmitting] = useState(false);

  // Labels are repo-specific options — clear them when the repo changes (not on mount).
  const repoOpts = useRepoOptions(repo);
  const firstRepo = useRef(true);
  useEffect(() => {
    if (firstRepo.current) {
      firstRepo.current = false;
      return;
    }
    setLabels([]);
  }, [repo]);

  const canCreate = !!repo && title.trim().length > 0 && !submitting;

  async function submit() {
    if (!repo || !title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const row = await api.createIssue({
        repo,
        title: title.trim(),
        body: body.trim() || undefined,
        assignees: assignee ? [assignee] : undefined,
        labels: labels.length ? labels : undefined,
        milestoneTitle: milestoneTitle || undefined,
        projectNumber: projectNumber ? Number(projectNumber) : undefined,
        type: type || undefined,
      });
      toast.success(`Created ${repo}#${row.number}`);
      qc.invalidateQueries({ queryKey: ["issues"] });
      onClose();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error)?.message ?? "error"}`);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          New issue · <span className="opacity-70">⌘/Ctrl+Enter create · Esc cancel</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Cancel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="text-sm"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the issue… (Markdown supported)"
          className="min-h-32 resize-none text-sm"
        />

        <Field label="Repository">
          <SingleSearchCombo
            placeholder="Select repository"
            searchPlaceholder="Search repos…"
            options={(repos.data ?? []).map((r) => ({ value: r.name, label: r.name }))}
            value={repo}
            onChange={setRepo}
          />
        </Field>

        {(issueTypes.data?.length ?? 0) > 0 && (
          <Field label="Type">
            <select className={selectCls} value={type ?? ""} onChange={(e) => setType(e.target.value || null)}>
              <option value="">No type</option>
              {issueTypes.data?.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Assignee">
          <SingleSearchCombo
            placeholder="Unassigned"
            searchPlaceholder="Search users…"
            options={(repoOpts.data?.assignees ?? []).map((a) => ({ value: a.login, label: a.login }))}
            value={assignee}
            onChange={setAssignee}
          />
        </Field>

        <Field label="Labels">
          <MultiSearchCombo
            chips
            placeholder="Add labels…"
            searchPlaceholder="Search labels…"
            options={(repoOpts.data?.labels ?? []).map((l) => ({ value: l.name, label: l.name, color: l.color }))}
            selected={labels}
            onChange={setLabels}
          />
        </Field>

        <Field label="Milestone">
          <SingleSearchCombo
            placeholder="No milestone"
            searchPlaceholder="Search milestones…"
            options={(milestones.data ?? []).map((m) => ({ value: m.title, label: m.title }))}
            value={milestoneTitle}
            onChange={setMilestoneTitle}
          />
        </Field>

        <Field label="Project">
          <SingleSearchCombo
            placeholder="No project"
            searchPlaceholder="Search projects…"
            options={(projects.data ?? []).map((p) => ({ value: String(p.number), label: p.title }))}
            value={projectNumber}
            onChange={setProjectNumber}
          />
        </Field>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-muted/20 px-3 py-2.5">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void submit()} disabled={!canCreate}>
          {submitting ? "Creating…" : "Create issue"}
        </Button>
      </div>
    </div>
  );
}
