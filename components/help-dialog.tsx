"use client";

import { Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/hooks/use-app-store";

interface Shortcut {
  keys: string[];
  label: string;
}

const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Navigate",
    items: [
      { keys: ["↑", "↓"], label: "Move cursor" },
      { keys: ["PgUp", "PgDn"], label: "Move ±10" },
      { keys: ["Home", "End"], label: "First / last row" },
      { keys: ["Tab"], label: "Switch pane" },
      { keys: ["Enter"], label: "Open on GitHub" },
      { keys: ["F3"], label: "Preview in the other pane" },
      { keys: ["Esc"], label: "Close preview · clear marks" },
    ],
  },
  {
    title: "Select",
    items: [
      { keys: ["Ins"], label: "Mark row and advance" },
      { keys: ["Shift+↑", "Shift+↓"], label: "Mark and move" },
      { keys: ["+", "Ctrl+A"], label: "Mark all" },
      { keys: ["−"], label: "Unmark all" },
      { keys: ["*"], label: "Invert marks" },
    ],
  },
  {
    title: "Filter",
    items: [
      { keys: ["F"], label: "Filter dialog" },
      { keys: ["/", "Ctrl+F"], label: "Filter dialog · search focused" },
      { keys: ["T S U M P R B D"], label: "…rows inside the dialog" },
      { keys: ["X"], label: "…clear all filters" },
      { keys: ["Enter"], label: "…apply · Esc cancels" },
    ],
  },
  {
    title: "Sources & data",
    items: [
      { keys: ["F1", "F2"], label: "Choose left / right source" },
      { keys: ["Ctrl+1", "Ctrl+2"], label: "Same (fallback)" },
      { keys: ["Ctrl+R"], label: "Refresh both panes" },
    ],
  },
  {
    title: "Act on issues",
    items: [
      { keys: ["F4"], label: "Edit body (in the other pane)" },
      { keys: ["F5"], label: "Copy to the other pane" },
      { keys: ["F6"], label: "Move to the other pane" },
      { keys: ["F7", "Space"], label: "Edit fields (bulk with marks)" },
      { keys: ["F8"], label: "Close — Enter confirms" },
      { keys: ["Ctrl+U"], label: "Quick-assign user" },
      { keys: ["Alt+Enter"], label: "New issue" },
    ],
  },
  {
    title: "Editors & dialogs",
    items: [
      { keys: ["Ctrl+Enter"], label: "Save / send / create" },
      { keys: ["Esc"], label: "Cancel / close" },
    ],
  },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/90"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** `?` — keyboard cheat sheet. */
export function HelpDialog() {
  const open = useAppStore((s) => s.helpOpen);
  const close = useAppStore((s) => s.closeHelp);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[44rem] max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[44rem]">
        <DialogHeader className="px-5 pb-1 pt-4">
          <DialogTitle className="text-sm">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs">
            Commander-style: the keyboard drives everything. Click any date in a list to toggle absolute ↔ relative.
          </DialogDescription>
        </DialogHeader>
        <div className="columns-1 gap-6 px-5 pb-5 pt-2 sm:columns-2">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-4 break-inside-avoid">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {g.title}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                {g.items.map((s) => (
                  <Fragment key={s.label}>
                    <span className="truncate text-foreground/85">{s.label}</span>
                    <Keys keys={s.keys} />
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
