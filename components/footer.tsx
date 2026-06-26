"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface FnKey {
  hotkey: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  reason?: string;
}

export function Footer({ keys }: { keys: FnKey[] }) {
  return (
    <div className="flex shrink-0 divide-x divide-border border-t border-border bg-secondary/60 font-mono text-sm">
      {keys.map((k) => {
        const btn = (
          <button
            type="button"
            disabled={k.disabled}
            onClick={k.onClick}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-3 py-2.5 transition-colors",
              k.disabled ? "cursor-not-allowed text-muted-foreground/40" : "hover:bg-primary/15",
            )}
          >
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-bold",
                k.disabled ? "bg-background/40 text-muted-foreground/50" : "bg-primary text-primary-foreground",
              )}
            >
              {k.hotkey}
            </span>
            <span>{k.label}</span>
          </button>
        );
        return (
          <Tooltip key={k.hotkey}>
            <TooltipTrigger asChild>{btn}</TooltipTrigger>
            {k.reason && <TooltipContent>{k.reason}</TooltipContent>}
          </Tooltip>
        );
      })}
    </div>
  );
}
