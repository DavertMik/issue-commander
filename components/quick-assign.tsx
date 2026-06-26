"use client";

import { Check } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAppStore } from "@/hooks/use-app-store";
import { useRepoOptions } from "@/hooks/use-repo-options";
import { useIssueActions } from "@/hooks/use-issue-mutations";

const MENU_W = 256;
const MENU_H = 300;

/** Ctrl+A — a searchable assignee picker anchored to the selected row; applies optimistically. */
export function QuickAssignPicker() {
  const target = useAppStore((s) => s.quickAssign);
  const close = useAppStore((s) => s.closeQuickAssign);
  const actions = useIssueActions();
  const repoOpts = useRepoOptions(target?.row.repo.name ?? null);

  if (!target) return null;
  const { row, rect } = target;
  const users = repoOpts.data?.assignees ?? [];
  const current = row.assignees[0]?.login ?? null;

  const pick = (login: string | null) => {
    if (login !== current) {
      void actions.applyIssueEdit({
        owner: row.repo.owner,
        repo: row.repo.name,
        number: row.number,
        issueKey: `${row.repo.name}#${row.number}`,
        assignees: login ? users.filter((a) => a.login === login) : [],
      });
    }
    close();
  };

  const openBelow = rect.bottom + MENU_H < window.innerHeight;
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_W - 8)),
    width: MENU_W,
    ...(openBelow ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={close} />
      <div
        style={style}
        className="z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-md"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <Command>
          <CommandInput placeholder={`Assign #${row.number}…`} autoFocus />
          <CommandList>
            <CommandEmpty>No users.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Unassigned" onSelect={() => pick(null)}>
                <span className="text-muted-foreground">Unassigned</span>
                {current === null && <Check className="ml-auto size-4 text-primary" />}
              </CommandItem>
              {users.map((u) => (
                <CommandItem key={u.login} value={u.login} onSelect={() => pick(u.login)}>
                  <span className="truncate">{u.login}</span>
                  {current === u.login && <Check className="ml-auto size-4 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </>
  );
}
