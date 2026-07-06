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
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SingleSearchCombo } from "@/components/search-combo";
import { useAppStore } from "@/hooks/use-app-store";
import { useMilestones, useProjects, useRepos } from "@/hooks/use-sources";
import { THEMES, type ThemeDef, type ThemeMode } from "@/lib/themes";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ThemeSwatch({ theme, selected, onSelect }: { theme: ThemeDef; selected: boolean; onSelect: () => void }) {
  const [bg, c1, c2] = theme.swatch;
  const text = theme.mode === "dark" ? "#f5f5f5" : "#1a1a1a";
  const hairline = theme.mode === "dark" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={theme.name}
      className="relative flex items-center gap-2 rounded-md border-2 p-2 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring hover:-translate-y-px"
      style={{ background: bg, borderColor: selected ? "var(--primary)" : hairline }}
    >
      <span className="flex shrink-0 gap-1">
        <span className="size-3 rounded-full" style={{ background: c1 }} />
        <span className="size-3 rounded-full" style={{ background: c2 }} />
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-xs font-medium" style={{ color: text }}>
        {theme.name}
      </span>
      {selected && (
        <Check className="size-3.5 shrink-0" style={{ color: "var(--primary)" }} strokeWidth={3} />
      )}
    </button>
  );
}

function ThemeGroup({ label, mode }: { label: string; mode: ThemeMode }) {
  const active = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  return (
    <div className="space-y-1.5">
      <span className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="grid grid-cols-2 gap-1.5">
        {THEMES.filter((t) => t.mode === mode).map((t) => (
          <ThemeSwatch key={t.id} theme={t} selected={active === t.id} onSelect={() => setTheme(t.id)} />
        ))}
      </div>
    </div>
  );
}

function ThemePicker() {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">Theme</span>
      <div className="space-y-2.5">
        <ThemeGroup label="Dark" mode="dark" />
        <ThemeGroup label="Light" mode="light" />
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const open = useAppStore((s) => s.settingsOpen);
  const close = useAppStore((s) => s.closeSettings);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[26rem] max-w-[calc(100vw-2rem)] flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-4 pb-2 pt-4">
          <DialogTitle className="text-sm">Settings</DialogTitle>
          <DialogDescription className="text-xs">
            Appearance, plus defaults used to pre-fill new issues (Alt+Enter).
          </DialogDescription>
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
    // `container` is the portal target for the comboboxes below, so it keeps `overflow`
    // visible (their dropdowns must not be clipped). Only the inner body scrolls.
    <div ref={container} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2 pt-1">
        <ThemePicker />
        <div className="h-px bg-border" />
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

      <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 rounded-b-xl border-t border-border bg-muted/20 px-4 py-3">
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
