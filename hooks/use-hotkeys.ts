"use client";

import { useEffect } from "react";
import { matchBinding, type ActionId } from "@/lib/hotkeys";
import { useAppStore } from "@/hooks/use-app-store";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Single global capture-phase keydown listener. Reads fresh UI state via
 * getState() (no stale closures), bails while typing or when a modal is open,
 * and dispatches the matched action through the stable `onAction` callback.
 */
export function useHotkeys(onAction: (a: ActionId) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const st = useAppStore.getState();
      // let dialogs/pickers/the new-issue form own the keyboard
      const newForm = st.panes.pane1.mode === "new" || st.panes.pane2.mode === "new";
      if (st.selector.open || st.confirm || st.editTargets || st.quickAssign || newForm || st.settingsOpen) return;
      const binding = matchBinding(e);
      if (!binding) return;
      if (binding.preventDefault) e.preventDefault();
      onAction(binding.action);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [onAction]);
}
