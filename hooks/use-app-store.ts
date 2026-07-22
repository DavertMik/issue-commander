import { create } from "zustand";
import { emptyFilter, type PaneFilter } from "@/lib/filters";
import { DEFAULT_LIGHT_THEME, DEFAULT_THEME, isThemeId, themeById, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";
import type { AppConfig, IssueRow, PaneSource, PaneView } from "@/lib/types";

export type { PaneView } from "@/lib/types";

const emptyConfig = (): AppConfig => ({ defaultRepository: null, defaultMilestone: null, defaultProject: null });

export type PaneId = "pane1" | "pane2";
export type PaneMode = "list" | "preview" | "edit" | "new";
export type ConfirmKind = "close" | "moveTransfer";
/** In-flight mutation status for a row, keyed by `repo#number`. */
export type OpStatus = "pending" | "done" | "error";

export function opposite(p: PaneId): PaneId {
  return p === "pane1" ? "pane2" : "pane1";
}

export interface PaneState {
  source: PaneSource | null;
  selectedIndex: number;
  mode: PaneMode;
  /** Issues vs Pull Requests (repo panes only; forced to "issues" for other sources). */
  view: PaneView;
  /** F4 buffer. */
  editDraft: string;
}

export interface ConfirmRequest {
  kind: ConfirmKind;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}


interface AppState {
  active: PaneId;
  panes: Record<PaneId, PaneState>;
  selector: { open: boolean; target: PaneId | null };
  confirm: ConfirmRequest | null;
  /** Issues being quick-edited via F7/Space (1 = single edit, >1 = bulk edit; null = closed). */
  editTargets: IssueRow[] | null;
  /** Global date display: false = absolute (locale), true = relative ("3 days ago"). */
  relativeDates: boolean;
  toggleRelativeDates: () => void;
  /** Per-pane set of recently-moved issue keys (`repo#number`) to flash-highlight. */
  flashed: Record<PaneId, Set<string>>;
  flashRow: (pane: PaneId, key: string) => void;
  /** In-flight mutation status per issue key; done/error auto-clear after 5s. */
  ops: Record<string, OpStatus>;
  beginOp: (key: string) => void;
  endOp: (key: string, ok: boolean) => void;
  /** Per-pane set of multi-selected issue keys (`repo#number`) for bulk ops. */
  selected: Record<PaneId, Set<string>>;
  toggleSelect: (pane: PaneId, key: string) => void;
  clearSelection: (pane: PaneId) => void;
  /** Replace a pane's whole selection (select all / invert). */
  setSelection: (pane: PaneId, keys: Set<string>) => void;
  /** Per-pane client-side filter (search / assignee / repo). */
  filters: Record<PaneId, PaneFilter>;
  /** The inactive view's filter per pane: Issues and Pull Requests each keep their
   * own filter, swapped in/out by setView so PR-only facets never leak into Issues. */
  filterStash: Record<PaneId, Partial<Record<PaneView, PaneFilter>>>;
  setFilter: (pane: PaneId, patch: Partial<PaneFilter>) => void;
  clearFilter: (pane: PaneId) => void;

  setActive: (p: PaneId) => void;
  toggleActive: () => void;
  setSource: (p: PaneId, s: PaneSource) => void;
  setSelectedIndex: (p: PaneId, i: number) => void;
  moveSelection: (p: PaneId, delta: number, len: number) => void;
  setMode: (p: PaneId, m: PaneMode) => void;
  setView: (p: PaneId, v: PaneView) => void;
  setEditDraft: (p: PaneId, v: string) => void;
  startPreview: (targetPane: PaneId) => void;
  clearPreview: (p: PaneId) => void;
  openSelector: (p: PaneId) => void;
  closeSelector: () => void;
  requestConfirm: (req: ConfirmRequest) => void;
  closeConfirm: () => void;
  openEdit: (rows: IssueRow[]) => void;
  closeEdit: () => void;
  /** Ctrl+U inline assignee picker: the target row + the screen rect of its row to anchor near. */
  quickAssign: { row: IssueRow; rect: { top: number; left: number; bottom: number; right: number } } | null;
  openQuickAssign: (row: IssueRow, rect: { top: number; left: number; bottom: number; right: number }) => void;
  closeQuickAssign: () => void;
  /** Alt+Enter renders a new-issue form in the SIBLING pane (mode "new"); this hints its default repo. */
  newIssueRepoHint: string | null;
  openNewIssue: (repoHint: string | null) => void;
  /** Settings dialog (default repo/milestone/project). */
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  /** F / `/` keyboard filter dialog: which pane it edits + whether the search row grabs focus. */
  filterDialog: { pane: PaneId; focusSearch: boolean } | null;
  openFilterDialog: (pane: PaneId, focusSearch?: boolean) => void;
  closeFilterDialog: () => void;
  /** `?` keyboard cheat-sheet overlay. */
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  /** Persisted user defaults (hydrated from / saved to localStorage by TotalCommander). */
  config: AppConfig;
  setConfig: (patch: Partial<AppConfig>) => void;
  /** Active color theme id; applied to <html> and persisted by TotalCommander. */
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  /** Last theme chosen in each mode, so the quick dark/light toggle restores your pick. */
  lastByMode: { dark: ThemeId; light: ThemeId };
  /** Flip between dark and light, returning to the last theme used in the target mode. */
  toggleMode: () => void;
}

/** Read the saved theme synchronously so first paint matches (no flash back to default). */
function initialTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(saved)) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

function initialLastByMode(): { dark: ThemeId; light: ThemeId } {
  const t = initialTheme();
  const mode = themeById(t).mode;
  return {
    dark: mode === "dark" ? t : DEFAULT_THEME,
    light: mode === "light" ? t : DEFAULT_LIGHT_THEME,
  };
}

const emptyPane = (): PaneState => ({
  source: null,
  selectedIndex: 0,
  mode: "list",
  view: "issues",
  editDraft: "",
});

function patchPane(state: AppState, p: PaneId, patch: Partial<PaneState>): Pick<AppState, "panes"> {
  return { panes: { ...state.panes, [p]: { ...state.panes[p], ...patch } } };
}

export const useAppStore = create<AppState>((set) => ({
  active: "pane1",
  panes: { pane1: emptyPane(), pane2: emptyPane() },
  selector: { open: false, target: null },
  confirm: null,
  editTargets: null,
  relativeDates: false,
  toggleRelativeDates: () => set((s) => ({ relativeDates: !s.relativeDates })),
  flashed: { pane1: new Set<string>(), pane2: new Set<string>() },
  selected: { pane1: new Set<string>(), pane2: new Set<string>() },
  filters: { pane1: emptyFilter(), pane2: emptyFilter() },
  filterStash: { pane1: {}, pane2: {} },
  ops: {},

  beginOp: (key) => set((s) => ({ ops: { ...s.ops, [key]: "pending" } })),
  endOp: (key, ok) => {
    const status: OpStatus = ok ? "done" : "error";
    set((s) => ({ ops: { ...s.ops, [key]: status } }));
    setTimeout(() => {
      set((s) => {
        if (s.ops[key] !== status) return {}; // a newer op started — leave it
        const next = { ...s.ops };
        delete next[key];
        return { ops: next };
      });
    }, 5000);
  },

  setFilter: (pane, patch) =>
    set((s) => ({
      filters: { ...s.filters, [pane]: { ...s.filters[pane], ...patch } },
      panes: { ...s.panes, [pane]: { ...s.panes[pane], selectedIndex: 0 } },
    })),

  clearFilter: (pane) =>
    set((s) => ({
      filters: { ...s.filters, [pane]: emptyFilter() },
      panes: { ...s.panes, [pane]: { ...s.panes[pane], selectedIndex: 0 } },
    })),

  toggleSelect: (pane, key) =>
    set((s) => {
      const next = new Set(s.selected[pane]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { selected: { ...s.selected, [pane]: next } };
    }),

  clearSelection: (pane) =>
    set((s) => (s.selected[pane].size === 0 ? {} : { selected: { ...s.selected, [pane]: new Set<string>() } })),

  setSelection: (pane, keys) => set((s) => ({ selected: { ...s.selected, [pane]: keys } })),

  flashRow: (pane, key) => {
    set((s) => {
      const next = new Set(s.flashed[pane]);
      next.add(key);
      return { flashed: { ...s.flashed, [pane]: next } };
    });
    setTimeout(() => {
      set((s) => {
        if (!s.flashed[pane].has(key)) return {};
        const next = new Set(s.flashed[pane]);
        next.delete(key);
        return { flashed: { ...s.flashed, [pane]: next } };
      });
    }, 3000);
  },

  setActive: (p) => set({ active: p }),
  toggleActive: () => set((s) => ({ active: opposite(s.active) })),

  setSource: (p, source) =>
    set((s) => ({
      // A non-repo source has no PR tab, so reset the view along with the filter/selection.
      ...patchPane(s, p, { source, selectedIndex: 0, mode: "list", view: "issues" }),
      selected: { ...s.selected, [p]: new Set<string>() },
      filters: { ...s.filters, [p]: emptyFilter() },
      filterStash: { ...s.filterStash, [p]: {} },
    })),

  setSelectedIndex: (p, i) => set((s) => patchPane(s, p, { selectedIndex: Math.max(0, i) })),

  moveSelection: (p, delta, len) =>
    set((s) => {
      if (len <= 0) return patchPane(s, p, { selectedIndex: 0 });
      const next = Math.min(len - 1, Math.max(0, s.panes[p].selectedIndex + delta));
      return patchPane(s, p, { selectedIndex: next });
    }),

  setMode: (p, mode) => set((s) => patchPane(s, p, { mode })),
  setView: (p, view) =>
    set((s) => {
      const prev = s.panes[p].view;
      if (prev === view) return patchPane(s, p, { view, selectedIndex: 0 });
      // Each view keeps its own filter: stash the outgoing view's, restore the incoming view's.
      return {
        ...patchPane(s, p, { view, selectedIndex: 0 }),
        filters: { ...s.filters, [p]: s.filterStash[p][view] ?? emptyFilter() },
        filterStash: { ...s.filterStash, [p]: { ...s.filterStash[p], [prev]: s.filters[p] } },
      };
    }),
  setEditDraft: (p, editDraft) => set((s) => patchPane(s, p, { editDraft })),

  startPreview: (targetPane) => set((s) => patchPane(s, targetPane, { mode: "preview" })),

  clearPreview: (p) => set((s) => patchPane(s, p, { mode: "list" })),

  openSelector: (p) => set({ selector: { open: true, target: p } }),
  closeSelector: () => set({ selector: { open: false, target: null } }),

  requestConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),

  openEdit: (rows) => set({ editTargets: rows.length ? rows : null }),
  closeEdit: () => set({ editTargets: null }),

  quickAssign: null,
  openQuickAssign: (row, rect) => set({ quickAssign: { row, rect } }),
  closeQuickAssign: () => set({ quickAssign: null }),

  newIssueRepoHint: null,
  // Show the form in the OTHER pane (like F3 preview); the active pane keeps the cursor.
  openNewIssue: (repoHint) =>
    set((s) => ({ ...patchPane(s, opposite(s.active), { mode: "new" }), newIssueRepoHint: repoHint })),

  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  filterDialog: null,
  openFilterDialog: (pane, focusSearch = false) => set({ filterDialog: { pane, focusSearch } }),
  closeFilterDialog: () => set({ filterDialog: null }),

  helpOpen: false,
  openHelp: () => set({ helpOpen: true }),
  closeHelp: () => set({ helpOpen: false }),

  config: emptyConfig(),
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

  theme: initialTheme(),
  lastByMode: initialLastByMode(),
  setTheme: (theme) =>
    set((s) => ({ theme, lastByMode: { ...s.lastByMode, [themeById(theme).mode]: theme } })),
  toggleMode: () =>
    set((s) => {
      const target = themeById(s.theme).mode === "dark" ? "light" : "dark";
      return { theme: s.lastByMode[target] };
    }),
}));
