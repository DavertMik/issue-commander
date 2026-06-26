"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Assignee } from "@/lib/types";

export function AssigneeAvatars({ assignees, max = 3 }: { assignees: Assignee[]; max?: number }) {
  if (!assignees.length) return <span className="text-muted-foreground">—</span>;
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((a, i) => (
        <Tooltip key={a.login}>
          <TooltipTrigger asChild>
            <Avatar className="size-6 border border-background" style={{ marginLeft: i === 0 ? 0 : -6 }}>
              <AvatarImage src={a.avatarUrl} alt={a.login} />
              <AvatarFallback className="text-[10px]">{a.login.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{a.login}</TooltipContent>
        </Tooltip>
      ))}
      {extra > 0 && <span className="ml-1 text-xs text-muted-foreground">+{extra}</span>}
    </span>
  );
}
