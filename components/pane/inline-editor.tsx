"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIssueDetail } from "@/hooks/use-comments";
import type { RepoRef } from "@/lib/types";

interface Props {
  repo: RepoRef;
  number: number;
  title: string;
  /** Returns true on success (editor closes), false to stay open. */
  onSave: (body: string) => Promise<boolean>;
  onCancel: () => void;
}

export function InlineEditor({ repo, number, title, onSave, onCancel }: Props) {
  const { data, isLoading } = useIssueDetail(repo, number);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const ready = !isLoading && data != null;
  // Derived: show the user's draft once they've typed, otherwise the loaded body.
  const value = draft ?? data?.body ?? "";

  useEffect(() => {
    if (ready) ref.current?.focus();
  }, [ready]);

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    const ok = await onSave(value);
    setSaving(false);
    if (!ok) ref.current?.focus();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-2">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {repo.name} · #{number} · editing — ⌘/Ctrl+Enter save · Esc cancel
        </div>
        <div className="truncate text-base font-semibold" title={title}>
          {title}
        </div>
      </div>
      {!ready ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Loading…</div>
      ) : (
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
        />
      )}
      <div className="flex shrink-0 justify-end gap-2 border-t border-border px-3 py-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={saving || !ready}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
