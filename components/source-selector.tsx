"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAppStore, type PaneId } from "@/hooks/use-app-store";
import { useMilestones, useProjects, useRepos } from "@/hooks/use-sources";
import type { PaneSource, ProjectOption } from "@/lib/types";

type Tab = "repo" | "milestone" | "project" | "recent";
const TABS: { id: Tab; label: string }[] = [
  { id: "repo", label: "Repositories" },
  { id: "milestone", label: "Milestones" },
  { id: "project", label: "Projects" },
  { id: "recent", label: "Recent" },
];

/**
 * Mounted only while the dialog is open, so its tab state resets to "repo"
 * on every open (no setState-in-effect needed).
 */
function SelectorBody({ target, onPick }: { target: PaneId; onPick: (s: PaneSource) => void }) {
  const [tab, setTab] = useState<Tab>("repo");
  const commandRef = useRef<HTMLDivElement>(null);

  const repos = useRepos(tab === "repo");
  const projects = useProjects(tab === "project");
  const milestones = useMilestones(tab === "milestone");

  // The "recent" tab has no search input to autofocus, so focus the cmdk root
  // itself — its keydown handler keeps ↑/↓/Enter working from there.
  useEffect(() => {
    if (tab === "recent") commandRef.current?.focus();
  }, [tab]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    // While a search query is being typed, ←/→ must keep moving the caret.
    if (e.target instanceof HTMLInputElement && e.target.value !== "") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const i = TABS.findIndex((t) => t.id === tab);
    setTab(TABS[(i + dir + TABS.length) % TABS.length].id);
  };

  return (
    <div onKeyDown={onKeyDown}>
      <DialogHeader className="px-4 pt-4">
        <DialogTitle className="text-sm">
          Select source · {target === "pane1" ? "left" : "right"} pane
        </DialogTitle>
        <DialogDescription className="text-xs">
          ←/→ switch source type · ↑/↓ navigate the list · Enter select
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-1 px-4 py-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Command ref={commandRef} tabIndex={-1} className="rounded-none border-t border-border bg-transparent outline-none">
        {tab === "repo" && (
          <>
            <CommandInput autoFocus placeholder="Search repositories…" />
            <CommandList>
              <CommandEmpty>{repos.isLoading ? "Loading…" : "No repositories."}</CommandEmpty>
              <CommandGroup>
                {repos.data?.map((r) => (
                  <CommandItem key={r.name} value={r.name} onSelect={() => onPick({ kind: "repo", repo: r.name })}>
                    <span className="truncate">{r.name}</span>
                    {r.private && <span className="ml-auto text-xs text-muted-foreground">private</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </>
        )}

        {tab === "milestone" && (
          <>
            <CommandInput autoFocus placeholder="Search milestones across the org…" />
            <CommandList>
              <CommandEmpty>{milestones.isLoading ? "Aggregating milestones…" : "No milestones."}</CommandEmpty>
              <CommandGroup heading="Open milestones · org-wide (by title)">
                {milestones.data?.map((m) => (
                  <CommandItem key={m.title} value={m.title} onSelect={() => onPick({ kind: "milestone", title: m.title })}>
                    <span className="truncate">{m.title}</span>
                    <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                      {m.repoCount} repo{m.repoCount === 1 ? "" : "s"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </>
        )}

        {tab === "project" && (
          <>
            <CommandInput autoFocus placeholder="Search projects…" />
            <CommandList>
              <CommandEmpty>{projects.isLoading ? "Loading…" : "No projects."}</CommandEmpty>
              <CommandGroup>
                {projects.data?.map((p: ProjectOption) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.title} ${p.number}`}
                    onSelect={() =>
                      onPick({ kind: "project", projectNumber: p.number, projectId: p.id, projectTitle: p.title })
                    }
                  >
                    <span className="truncate">{p.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">#{p.number}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </>
        )}

        {tab === "recent" && (
          <CommandList>
            <CommandGroup>
              <CommandItem value="recent recently updated involving me" onSelect={() => onPick({ kind: "recent" })}>
                <span className="truncate">Recently updated · issues involving me</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        )}
      </Command>
    </div>
  );
}

export function SourceSelector() {
  const open = useAppStore((s) => s.selector.open);
  const target = useAppStore((s) => s.selector.target);
  const close = useAppStore((s) => s.closeSelector);
  const setSource = useAppStore((s) => s.setSource);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {open && target && (
          <SelectorBody
            target={target}
            onPick={(source) => {
              setSource(target, source);
              close();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
