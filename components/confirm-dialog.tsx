"use client";

import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/hooks/use-app-store";

export function ConfirmDialog() {
  const confirm = useAppStore((s) => s.confirm);
  const close = useAppStore((s) => s.closeConfirm);
  const actionRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      open={!!confirm}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <AlertDialogContent
        // Commander-style: F8 → Enter confirms. Radix focuses Cancel by default,
        // which made Enter a silent no-op; focus the action instead (Esc still cancels).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          actionRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction ref={actionRef} onClick={() => confirm?.onConfirm()}>
            {confirm?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
