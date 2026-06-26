"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Label } from "@/lib/types";

/** Pick black/white text for a GitHub label color by perceived luminance. */
function readableFg(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#000";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000" : "#fff";
}

export function LabelBadges({ labels, max = 3 }: { labels: Label[]; max?: number }) {
  if (!labels.length) return <span className="text-muted-foreground">—</span>;
  const shown = labels.slice(0, max);
  const rest = labels.slice(max);
  return (
    <span className="flex items-center gap-1 overflow-hidden">
      {shown.map((l) => (
        <Badge
          key={l.name}
          className="h-5 border-transparent px-2 text-xs font-medium leading-none"
          style={{ backgroundColor: `#${l.color}`, color: readableFg(l.color) }}
        >
          {l.name}
        </Badge>
      ))}
      {rest.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default text-xs text-muted-foreground">+{rest.length}</span>
          </TooltipTrigger>
          <TooltipContent>{rest.map((r) => r.name).join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
