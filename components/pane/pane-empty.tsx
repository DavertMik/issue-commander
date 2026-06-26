"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PaneLoading() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export function PaneMessage({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-1" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
