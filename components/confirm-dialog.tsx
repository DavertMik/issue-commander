"use client";

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

  return (
    <AlertDialog
      open={!!confirm}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => confirm?.onConfirm()}>
            {confirm?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
