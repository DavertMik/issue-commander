/**
 * Color themes. Each theme is a full set of CSS custom properties defined in
 * `app/globals.css` under `[data-theme="<id>"]` (dark themes additionally get the
 * `.dark` class so Tailwind's `dark:` utilities stay live). This module is the
 * client/server-safe registry of theme *metadata* — ids, display names, mode, and a
 * few swatch colors used to render previews in the Settings dialog.
 *
 * `commander` (the original Norton-Commander blue) is expressed by the base `.dark`
 * block, so it has no `[data-theme]` override and is the default.
 */
export type ThemeMode = "dark" | "light";

export type ThemeId =
  | "commander"
  | "monokai"
  | "dracula"
  | "nord"
  | "solarized-dark"
  | "tokyo-night"
  | "paper"
  | "solarized-light"
  | "github-light"
  | "one-light"
  | "rose-pine-dawn"
  | "dracula-light";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  /** Preview swatches for the switcher: [background, primary accent, secondary accent]. */
  swatch: [string, string, string];
}

export const DEFAULT_THEME: ThemeId = "commander";
/** Fallback picked by the quick dark/light toggle when no light theme has been used yet. */
export const DEFAULT_LIGHT_THEME: ThemeId = "paper";

/** localStorage key for the persisted theme id. */
export const THEME_STORAGE_KEY = "total-issues:theme";

/** Ordered for display: dark themes first, then light. */
export const THEMES: ThemeDef[] = [
  // ── Dark ────────────────────────────────────────────────────────────────
  { id: "commander", name: "Commander", mode: "dark", swatch: ["#16223a", "#4cc4e0", "#6ea8fe"] },
  { id: "monokai", name: "Monokai", mode: "dark", swatch: ["#272822", "#f92672", "#a6e22e"] },
  { id: "dracula", name: "Dracula", mode: "dark", swatch: ["#282a36", "#bd93f9", "#ff79c6"] },
  { id: "nord", name: "Nord", mode: "dark", swatch: ["#2e3440", "#88c0d0", "#81a1c1"] },
  { id: "solarized-dark", name: "Solarized Dark", mode: "dark", swatch: ["#002b36", "#268bd2", "#2aa198"] },
  { id: "tokyo-night", name: "Tokyo Night", mode: "dark", swatch: ["#1a1b26", "#7aa2f7", "#bb9af7"] },
  // ── Light ───────────────────────────────────────────────────────────────
  { id: "paper", name: "Paper", mode: "light", swatch: ["#faf9f7", "#0f766e", "#d97706"] },
  { id: "solarized-light", name: "Solarized Light", mode: "light", swatch: ["#fdf6e3", "#268bd2", "#2aa198"] },
  { id: "github-light", name: "GitHub Light", mode: "light", swatch: ["#ffffff", "#0969da", "#1a7f37"] },
  { id: "one-light", name: "One Light", mode: "light", swatch: ["#fafafa", "#4078f2", "#a626a4"] },
  { id: "rose-pine-dawn", name: "Rosé Pine Dawn", mode: "light", swatch: ["#faf4ed", "#907aa9", "#d7827e"] },
  { id: "dracula-light", name: "Dracula Light", mode: "light", swatch: ["#f5f3fb", "#7c3aed", "#d6336c"] },
];

const BY_ID = new Map<string, ThemeDef>(THEMES.map((t) => [t.id, t]));

/** Resolve an id (from localStorage etc.) to a known theme, falling back to the default. */
export function themeById(id: string | null | undefined): ThemeDef {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_THEME)!;
}

export function isThemeId(id: string | null | undefined): id is ThemeId {
  return !!id && BY_ID.has(id);
}
