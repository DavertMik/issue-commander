// Pure key-descriptor -> action mapping. Kept data-only so it's testable and the
// fallback bindings live in one place.

export type ActionId =
  | "toggleActive"
  | "up"
  | "down"
  | "pageUp"
  | "pageDown"
  | "open"
  | "preview"
  | "edit"
  | "copy"
  | "move"
  | "editIssue"
  | "quickAssign"
  | "newIssue"
  | "close"
  | "selector1"
  | "selector2"
  | "toggleSelect"
  | "escape";

export interface Binding {
  action: ActionId;
  preventDefault: boolean;
}

/**
 * Notes on browser/OS capture:
 *  - F5 (reload) and F3 (find) are the high-stakes keys — preventDefault in the
 *    capture-phase listener handles them.
 *  - Alt+F4 is intentionally NOT bound (close is F8); Windows can't prevent it.
 *  - F1/F2 open the source selector for the left/right pane (Alt+F1/F2 was the
 *    original binding, but Alt+F2 is swallowed by some Linux window managers).
 *    Ctrl+1/Ctrl+2 and the clickable pane headers remain as fallbacks.
 */
export function matchBinding(e: KeyboardEvent): Binding | null {
  const k = e.key;

  if (e.ctrlKey && !e.metaKey && !e.altKey) {
    if (k === "1") return { action: "selector1", preventDefault: true };
    if (k === "2") return { action: "selector2", preventDefault: true };
    if (k === "u" || k === "U") return { action: "quickAssign", preventDefault: true };
    return null;
  }

  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    if (k === "Enter") return { action: "newIssue", preventDefault: true };
    return null;
  }

  if (e.metaKey || e.ctrlKey || e.altKey) return null;

  switch (k) {
    case "F1":
      return { action: "selector1", preventDefault: true };
    case "F2":
      return { action: "selector2", preventDefault: true };
    case "Tab":
      return { action: "toggleActive", preventDefault: true };
    case "ArrowUp":
      return { action: "up", preventDefault: true };
    case "ArrowDown":
      return { action: "down", preventDefault: true };
    case "PageUp":
      return { action: "pageUp", preventDefault: true };
    case "PageDown":
      return { action: "pageDown", preventDefault: true };
    case "Enter":
      return { action: "open", preventDefault: true };
    case " ": // Space — alias for F7 quick-edit
      return { action: "editIssue", preventDefault: true };
    case "Insert":
      return { action: "toggleSelect", preventDefault: true };
    case "F3":
      return { action: "preview", preventDefault: true };
    case "F4":
      return { action: "edit", preventDefault: true };
    case "F5":
      return { action: "copy", preventDefault: true };
    case "F6":
      return { action: "move", preventDefault: true };
    case "F7":
      return { action: "editIssue", preventDefault: true };
    case "F8":
      return { action: "close", preventDefault: true };
    case "Escape":
      return { action: "escape", preventDefault: false };
    default:
      return null;
  }
}
