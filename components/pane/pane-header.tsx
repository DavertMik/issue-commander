"use client";

import { Folder, Flag, History, LayoutGrid, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { sourceLabel } from "@/lib/source";
import type { PaneSource } from "@/lib/types";

function KindIcon({ source }: { source: PaneSource | null }) {
  const cls = "size-4 shrink-0";
  if (source?.kind === "milestone") return <Flag className={cls} />;
  if (source?.kind === "project") return <LayoutGrid className={cls} />;
  if (source?.kind === "recent") return <History className={cls} />;
  return <Folder className={cls} />;
}

interface Props {
  source: PaneSource | null;
  active: boolean;
  count?: number;
  selectedCount?: number;
  hotkey: string;
  onOpenSelector: () => void;
}

export function PaneHeader({ source, active, count, selectedCount, hotkey, onOpenSelector }: Props) {
  // Only the title and the chevron open the source selector — clicking the count/badges does not.
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 border-b border-border px-3 py-2.5 font-mono text-sm",
        active ? "bg-primary/20 text-foreground" : "bg-muted/30 text-muted-foreground",
      )}
    >
      <button
        type="button"
        onClick={onOpenSelector}
        title={`${sourceLabel(source)} — ${hotkey} to change`}
        className="flex min-w-0 items-center gap-2 text-left transition-colors hover:text-foreground"
      >
        <KindIcon source={source} />
        <span className="truncate font-semibold">{sourceLabel(source)}</span>
      </button>
      {selectedCount != null && selectedCount > 0 && (
        <span className="ml-auto rounded bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-300 tabular-nums">
          {selectedCount} ✓
        </span>
      )}
      {count != null && (
        <span
          className={cn(
            "rounded bg-background/60 px-2 py-0.5 text-xs tabular-nums",
            selectedCount ? "ml-1.5" : "ml-auto",
          )}
        >
          {count}
        </span>
      )}
      <button
        type="button"
        onClick={onOpenSelector}
        title={`Change source (${hotkey})`}
        className={cn("rounded p-0.5 opacity-50 transition-opacity hover:opacity-100", count != null ? "ml-1" : "ml-auto")}
      >
        <ChevronDown className="size-3.5" />
      </button>
      <span className="rounded bg-background/50 px-1.5 py-0.5 text-xs opacity-70">{hotkey}</span>
    </div>
  );
}
