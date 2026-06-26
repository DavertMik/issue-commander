"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SingleSearchCombo } from "@/components/search-combo";
import { useAppStore } from "@/hooks/use-app-store";
import { useMilestones, useProjects, useRepos } from "@/hooks/use-sources";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function SettingsDialog() {
  const open = useAppStore((s) => s.settingsOpen);
  const close = useAppStore((s) => s.closeSettings);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex w-[26rem] max-w-[calc(100vw-2rem)] flex-col gap-0 p-0">
        <DialogHeader className="px-4 pb-2 pt-4">
          <DialogTitle className="text-sm">Settings</DialogTitle>
          <DialogDescription className="text-xs">Defaults used to pre-fill new issues (Alt+Enter).</DialogDescription>
        </DialogHeader>
        {open && <SettingsBody onClose={close} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({ onClose }: { onClose: () => void }) {
  const setConfig = useAppStore((s) => s.setConfig);
  const repos = useRepos(true);
  const milestones = useMilestones(true);
  const projects = useProjects(true);
  const container = useRef<HTMLDivElement>(null);

  const [repo, setRepo] = useState<string | null>(() => useAppStore.getState().config.defaultRepository);
  const [milestone, setMilestone] = useState<string | null>(() => useAppStore.getState().config.defaultMilestone);
  const [project, setProject] = useState<string | null>(() => {
    const p = useAppStore.getState().config.defaultProject;
    return p != null ? String(p) : null;
  });

  function save() {
    setConfig({
      defaultRepository: repo,
      defaultMilestone: milestone,
      defaultProject: project ? Number(project) : null,
    });
    onClose();
  }

  return (
    <div ref={container}>
      <div className="space-y-3 px-4 pb-2 pt-1">
        <Field label="Repository">
          <SingleSearchCombo
            placeholder="None"
            searchPlaceholder="Search repos…"
            options={(repos.data ?? []).map((r) => ({ value: r.name, label: r.name }))}
            value={repo}
            onChange={setRepo}
            container={container}
          />
        </Field>
        <Field label="Milestone">
          <SingleSearchCombo
            placeholder="None"
            searchPlaceholder="Search milestones…"
            options={(milestones.data ?? []).map((m) => ({ value: m.title, label: m.title }))}
            value={milestone}
            onChange={setMilestone}
            container={container}
          />
        </Field>
        <Field label="Project">
          <SingleSearchCombo
            placeholder="None"
            searchPlaceholder="Search projects…"
            options={(projects.data ?? []).map((p) => ({ value: String(p.number), label: p.title }))}
            value={project}
            onChange={setProject}
            container={container}
          />
        </Field>
      </div>

      <DialogFooter className="gap-2 border-t border-border bg-muted/20 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={save}>
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}
