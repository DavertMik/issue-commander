// Pure key-descriptor -> action mapping. Kept data-only so it's testable and the
// fallback bindings live in one place.

export type ActionId =
  | "toggleActive"
  | "up"
  | "down"
  | "pageUp"
  | "pageDown"
  | "home"
  | "end"
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
  | "selectUp"
  | "selectDown"
  | "selectAll"
  | "selectNone"
  | "selectInvert"
  | "openFilter"
  | "openFilterSearch"
  | "refresh"
  | "help"
  | "escape";

export interface Binding {
  action: ActionId;
  preventDefault: boolean;
}

/**
 * Notes on browser/OS capture:
 *  - F5 (reload) and F3 (find) are the high-stakes keys — preventDefault in the
 *    capture-phase listener handles them. Same for Ctrl+F (find) and Ctrl+R
 *    (reload): both are deliberately repurposed (filter / refetch panes).
 *  - Alt+F4 is intentionally NOT bound (close is F8); Windows can't prevent it.
 *  - F1/F2 open the source selector for the left/right pane (Alt+F1/F2 was the
 *    original binding, but Alt+F2 is swallowed by some Linux window managers).
 *    Ctrl+1/Ctrl+2 and the clickable pane headers remain as fallbacks.
 *  - + / - / * mirror Total Commander's Gray+/Gray−/Gray* (select all/none/invert)
 *    and arrive as those e.key values from both the numpad and shifted digits.
 */
export function matchBinding(e: KeyboardEvent): Binding | null {
  const k = e.key;

  if (e.ctrlKey && !e.metaKey && !e.altKey) {
    if (k === "1") return { action: "selector1", preventDefault: true };
    if (k === "2") return { action: "selector2", preventDefault: true };
    if (k === "u" || k === "U") return { action: "quickAssign", preventDefault: true };
    if (k === "a" || k === "A") return { action: "selectAll", preventDefault: true };
    if (k === "r" || k === "R") return { action: "refresh", preventDefault: true };
    if (k === "f" || k === "F") return { action: "openFilterSearch", preventDefault: true };
    return null;
  }

  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    if (k === "Enter") return { action: "newIssue", preventDefault: true };
    return null;
  }

  if (e.metaKey || e.ctrlKey || e.altKey) return null;

  // Shift+↑/↓ mark-and-move (TC-style range selection). Other shifted keys fall
  // through to the switch — e.key already carries the shifted symbol (+ * ?).
  if (e.shiftKey) {
    if (k === "ArrowUp") return { action: "selectUp", preventDefault: true };
    if (k === "ArrowDown") return { action: "selectDown", preventDefault: true };
  }

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
    case "Home":
      return { action: "home", preventDefault: true };
    case "End":
      return { action: "end", preventDefault: true };
    case "Enter":
      return { action: "open", preventDefault: true };
    case " ": // Space — alias for F7 quick-edit
      return { action: "editIssue", preventDefault: true };
    case "Insert":
      return { action: "toggleSelect", preventDefault: true };
    case "+":
      return { action: "selectAll", preventDefault: true };
    case "-":
      return { action: "selectNone", preventDefault: true };
    case "*":
      return { action: "selectInvert", preventDefault: true };
    case "f":
    case "F":
      return { action: "openFilter", preventDefault: true };
    case "/":
      return { action: "openFilterSearch", preventDefault: true };
    case "?":
      return { action: "help", preventDefault: true };
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
