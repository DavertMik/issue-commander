"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Pane } from "@/components/pane/pane";
import { Footer, type FnKey } from "@/components/footer";
import { SourceSelector } from "@/components/source-selector";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EditDialog } from "@/components/edit-dialog";
import { QuickAssignPicker } from "@/components/quick-assign";
import { SettingsDialog } from "@/components/settings-dialog";
import { Moon, Plus, Settings, Sun } from "lucide-react";
import { opposite, useAppStore, type PaneId } from "@/hooks/use-app-store";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useIssues } from "@/hooks/use-issues";
import { useIssueActions } from "@/hooks/use-issue-mutations";
import { canCopy, canMove } from "@/lib/transfer";
import { applyFilters, emptyFilter, type PaneFilter } from "@/lib/filters";
import { DEFAULT_THEME, themeById, THEME_STORAGE_KEY } from "@/lib/themes";
import type { ActionId } from "@/lib/hotkeys";
import type { AppConfig, IssueRow, PaneSource, PaneView, RepoRef } from "@/lib/types";

// Issue-only mutations: disabled in the PR view (F3 preview is allowed — it's read-only).
const PR_DISABLED_ACTIONS = new Set<ActionId>(["edit", "copy", "move", "editIssue", "close", "quickAssign"]);

// Stable no-op subscribe for the `mounted` useSyncExternalStore (state never changes after mount).
const subscribeNoop = () => () => {};

interface PreviewTarget {
  repo: RepoRef;
  number: number;
  title: string;
  row: IssueRow;
}

const SOURCES_KEY = "total-issues:sources";
const FILTERS_KEY = "total-issues:filters";
const CONFIG_KEY = "total-issues:config";
const PAGE_JUMP = 10; // rows moved per PageUp / PageDown

export function TotalCommander({ org, defaults }: { org: string | null; defaults?: AppConfig | null }) {
  const active = useAppStore((s) => s.active);
  const panes = useAppStore((s) => s.panes);
  const selected = useAppStore((s) => s.selected);
  const filters = useAppStore((s) => s.filters);
  const actions = useIssueActions();
  const qc = useQueryClient();

  const q1 = useIssues(panes.pane1.source, filters.pane1.state, panes.pane1.view);
  const q2 = useIssues(panes.pane2.source, filters.pane2.state, panes.pane2.view);

  // Filtered rows drive navigation, selection, and the footer so they match what each pane shows.
  const rows1 = useMemo(() => applyFilters(q1.rows, filters.pane1), [q1.rows, filters.pane1]);
  const rows2 = useMemo(() => applyFilters(q2.rows, filters.pane2), [q2.rows, filters.pane2]);

  // ----- persist pane sources + views + filters to localStorage -----
  const setSource = useAppStore((s) => s.setSource);
  const setFilter = useAppStore((s) => s.setFilter);
  const setView = useAppStore((s) => s.setView);
  const p1src = panes.pane1.source;
  const p2src = panes.pane2.source;
  const p1view = panes.pane1.view;
  const p2view = panes.pane2.view;
  const firstSave = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SOURCES_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          pane1?: PaneSource | null;
          pane2?: PaneSource | null;
          views?: { pane1?: PaneView; pane2?: PaneView };
        };
        // Restore sources first (setSource resets that pane's view + filter), then views, then filters.
        if (saved.pane1) setSource("pane1", saved.pane1);
        if (saved.pane2) setSource("pane2", saved.pane2);
        if (saved.views?.pane1 && saved.pane1?.kind === "repo") setView("pane1", saved.views.pane1);
        if (saved.views?.pane2 && saved.pane2?.kind === "repo") setView("pane2", saved.views.pane2);
      }
      const rawF = localStorage.getItem(FILTERS_KEY);
      if (rawF) {
        const saved = JSON.parse(rawF) as { pane1?: Partial<PaneFilter>; pane2?: Partial<PaneFilter> };
        if (saved.pane1) setFilter("pane1", { ...emptyFilter(), ...saved.pane1 });
        if (saved.pane2) setFilter("pane2", { ...emptyFilter(), ...saved.pane2 });
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, [setSource, setView, setFilter]);

  useEffect(() => {
    // Skip the initial mount write so we don't clobber saved values before restore.
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    try {
      localStorage.setItem(
        SOURCES_KEY,
        JSON.stringify({ pane1: p1src, pane2: p2src, views: { pane1: p1view, pane2: p2view } }),
      );
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [p1src, p2src, p1view, p2view, filters]);

  // ----- persist user defaults (settings) to localStorage -----
  const config = useAppStore((s) => s.config);
  const setConfig = useAppStore((s) => s.setConfig);
  const firstConfigSave = useRef(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        setConfig(JSON.parse(raw));
        return;
      }
    } catch {
      // ignore
    }
    // No saved config yet → seed from the server-provided defaults (--repo / --milestone /
    // --project or IC_DEFAULT_*). The Settings dialog then overrides and persists.
    if (defaults) setConfig(defaults);
  }, [setConfig, defaults]);
  useEffect(() => {
    if (firstConfigSave.current) {
      firstConfigSave.current = false;
      return;
    }
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  // ----- apply + persist the color theme -----
  // The store seeds `theme` from localStorage synchronously (see initialTheme) and an
  // inline script in layout.tsx paints it before hydration, so this just keeps <html>
  // in sync when the user switches themes in Settings.
  const theme = useAppStore((s) => s.theme);
  // The store seeds `theme` from localStorage on the client, but the server always
  // starts from DEFAULT_THEME, so rendering the theme-dependent icon on the first
  // client render would mismatch the SSR HTML. Gate it behind a post-hydration flag:
  // the first client render matches the server (DEFAULT_THEME), then swaps in the
  // real theme after mount. (The inline script in layout.tsx already prevents a CSS flash.)
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const displayMode = themeById(mounted ? theme : DEFAULT_THEME).mode;
  useEffect(() => {
    const def = themeById(theme);
    const el = document.documentElement;
    el.setAttribute("data-theme", def.id);
    el.classList.toggle("dark", def.mode === "dark");
    el.style.colorScheme = def.mode;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, def.id);
    } catch {
      // ignore
    }
  }, [theme]);

  // Latest per-pane context for the keydown handler (read via ref to avoid stale
  // closures). Updated in an effect (never during render) so concurrent renders stay safe.
  type PaneCtx = { rows: IssueRow[]; hasNextPage: boolean; fetchNextPage: () => void };
  const ctxRef = useRef<Record<PaneId, PaneCtx>>({
    pane1: { rows: rows1, hasNextPage: q1.hasNextPage, fetchNextPage: q1.fetchNextPage },
    pane2: { rows: rows2, hasNextPage: q2.hasNextPage, fetchNextPage: q2.fetchNextPage },
  });
  useEffect(() => {
    ctxRef.current = {
      pane1: { rows: rows1, hasNextPage: q1.hasNextPage, fetchNextPage: q1.fetchNextPage },
      pane2: { rows: rows2, hasNextPage: q2.hasNextPage, fetchNextPage: q2.fetchNextPage },
    };
  });

  const runAction = useCallback(
    (a: ActionId) => {
      const st = useAppStore.getState();
      const activeId = st.active;
      const oppId = opposite(activeId);
      const ctx = ctxRef.current[activeId];
      const activeRows = ctx.rows;
      // Navigable length includes the trailing "load more" sentinel.
      const navLen = activeRows.length + (ctx.hasNextPage ? 1 : 0);
      const idx = Math.min(st.panes[activeId].selectedIndex, Math.max(0, navLen - 1));
      const onSentinel = ctx.hasNextPage && idx >= activeRows.length;
      const row = onSentinel ? undefined : activeRows[idx];
      const activeSource = st.panes[activeId].source;
      const oppSource = st.panes[oppId].source;

      // The PR view is browse-only — issue mutations don't apply to pull requests.
      if (st.panes[activeId].view === "pulls" && PR_DISABLED_ACTIONS.has(a)) return;

      // Bulk ops act on the active pane's selection, falling back to the highlighted row.
      const selectedKeys = st.selected[activeId];
      const selectedRows =
        selectedKeys.size > 0 ? activeRows.filter((r) => selectedKeys.has(`${r.repo.name}#${r.number}`)) : [];
      const targets = selectedRows.length ? selectedRows : row ? [row] : [];
      const flash = (k: string) => st.flashRow(oppId, k);

      switch (a) {
        case "toggleActive":
          st.toggleActive();
          break;
        case "up":
          st.moveSelection(activeId, -1, navLen);
          break;
        case "down":
          st.moveSelection(activeId, 1, navLen);
          break;
        case "pageUp":
          st.moveSelection(activeId, -PAGE_JUMP, navLen);
          break;
        case "pageDown":
          st.moveSelection(activeId, PAGE_JUMP, navLen);
          break;
        case "open":
          if (onSentinel) ctx.fetchNextPage();
          else if (row) window.open(row.htmlUrl, "_blank", "noopener,noreferrer");
          break;
        case "selector1":
          st.openSelector("pane1");
          break;
        case "selector2":
          st.openSelector("pane2");
          break;
        case "escape":
          (["pane1", "pane2"] as PaneId[]).forEach((p) => {
            if (st.panes[p].mode === "preview") st.clearPreview(p);
          });
          break;
        case "toggleSelect":
          // Mark the current row and advance, so Ins-Ins-Ins selects consecutively (TC-style).
          if (row) {
            st.toggleSelect(activeId, `${row.repo.name}#${row.number}`);
            st.moveSelection(activeId, 1, navLen);
          }
          break;
        case "preview":
          if (!row) break;
          if (st.panes[oppId].mode === "preview") st.clearPreview(oppId);
          else st.startPreview(oppId);
          break;
        case "edit":
          // Edit in the OTHER pane (consistent with F3 preview / Alt+Enter new).
          if (row) st.setMode(oppId, "edit");
          break;
        case "editIssue":
          // Selection → bulk edit; otherwise edit the highlighted row.
          if (targets.length) st.openEdit(targets);
          break;
        case "newIssue":
          // Seed the default repo from the highlighted row (milestone/recent/project panes span repos).
          st.openNewIssue(row?.repo.name ?? null);
          break;
        case "quickAssign": {
          if (!row) break;
          const el = document.querySelector(`[data-pane="${activeId}"] [data-index="${idx}"]`);
          const r = el?.getBoundingClientRect();
          st.openQuickAssign(
            row,
            r
              ? { top: r.top, left: r.left, bottom: r.bottom, right: r.right }
              : { top: 120, left: 120, bottom: 140, right: 320 },
          );
          break;
        }
        case "close": {
          if (!targets.length) break;
          st.requestConfirm({
            kind: "close",
            title: targets.length === 1 ? `Close issue #${targets[0].number}?` : `Close ${targets.length} issues?`,
            description: targets.length === 1 ? targets[0].title : targets.map((r) => `#${r.number}`).join(", "),
            confirmLabel: "Close",
            onConfirm: () => {
              void actions.bulkClose(targets, activeSource);
              st.clearSelection(activeId);
            },
          });
          break;
        }
        case "copy": {
          if (!targets.length) break;
          const res = canCopy(targets[0], oppSource);
          if (!res.ok) {
            toast.error(res.reason ?? "Cannot copy");
            break;
          }
          void actions.bulkCopy(targets, oppSource, flash);
          st.clearSelection(activeId);
          break;
        }
        case "move": {
          if (!targets.length) break;
          const eligible = targets.filter((r) => canMove(r, activeSource, oppSource).ok);
          if (!eligible.length) {
            toast.error(canMove(targets[0], activeSource, oppSource).reason ?? "Cannot move");
            break;
          }
          const skipped = targets.length - eligible.length;
          const dest = oppSource;
          const doMove = () => {
            void actions.bulkMove(eligible, activeSource, dest, flash);
            st.clearSelection(activeId);
            if (skipped) toast.message(`${skipped} skipped (not eligible)`);
          };
          if (dest?.kind === "repo") {
            st.requestConfirm({
              kind: "moveTransfer",
              title:
                eligible.length === 1
                  ? `Transfer #${eligible[0].number} to ${dest.repo}?`
                  : `Transfer ${eligible.length} issues to ${dest.repo}?`,
              description: "GitHub assigns new issue numbers; old URLs will redirect.",
              confirmLabel: "Transfer",
              onConfirm: doMove,
            });
          } else {
            doMove();
          }
          break;
        }
      }
    },
    [actions],
  );

  useHotkeys(runAction);

  // ----- footer validity for the active pane's target (selection, else highlighted row) -----
  const activeRows = active === "pane1" ? rows1 : rows2;
  const activeHasNext = active === "pane1" ? q1.hasNextPage : q2.hasNextPage;
  const activeMax = activeRows.length - 1 + (activeHasNext ? 1 : 0);
  const activeIdx = Math.min(panes[active].selectedIndex, Math.max(0, activeMax));
  const activeRow = activeRows[activeIdx]; // undefined when the "load more" sentinel is selected
  const oppSource = panes[opposite(active)].source;
  const activeSource = panes[active].source;

  // Preload the description of the ticket under the cursor (debounced) so F3 / preview is instant.
  const cursorKey = activeRow ? `${activeRow.repo.owner}/${activeRow.repo.name}#${activeRow.number}` : null;
  useEffect(() => {
    if (!activeRow) return;
    const { repo, number } = activeRow;
    const isPr = !!activeRow.pr;
    const t = setTimeout(() => {
      void qc.prefetchQuery({
        queryKey: ["issueDetail", repo.owner, repo.name, number],
        queryFn: () => api.issueDetail(repo.owner, repo.name, number, isPr),
        staleTime: 60_000,
      });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorKey, qc]);

  const markedActive = selected[active];
  const footerTargets =
    markedActive.size > 0
      ? activeRows.filter((r) => markedActive.has(`${r.repo.name}#${r.number}`))
      : activeRow
        ? [activeRow]
        : [];
  const footerRow = footerTargets[0];
  const copyRes = canCopy(footerRow, oppSource);
  const moveRes = canMove(footerRow, activeSource, oppSource);
  const suffix = footerTargets.length > 1 ? ` (${footerTargets.length})` : "";

  // A preview pane follows the OTHER pane's current selection (live, no snapshot).
  const previewTargetFor = (previewPane: PaneId): PreviewTarget | null => {
    const srcRows = previewPane === "pane1" ? rows2 : rows1;
    if (srcRows.length === 0) return null;
    const srcId = opposite(previewPane);
    const row = srcRows[Math.min(panes[srcId].selectedIndex, srcRows.length - 1)];
    return row ? { repo: row.repo, number: row.number, title: row.title, row } : null;
  };
  // Preview AND inline-edit render the other pane's cursor row, so both need the target.
  const previewTarget1 =
    panes.pane1.mode === "preview" || panes.pane1.mode === "edit" ? previewTargetFor("pane1") : null;
  const previewTarget2 =
    panes.pane2.mode === "preview" || panes.pane2.mode === "edit" ? previewTargetFor("pane2") : null;

  // The PR view is browse-only, so the issue-mutation function keys are disabled there.
  const activeIsPulls = panes[active].view === "pulls";
  const prReason = "Not available in the Pull Requests view";
  const footerKeys: FnKey[] = [
    { hotkey: "F3", label: "View", onClick: () => runAction("preview"), disabled: !activeRow },
    { hotkey: "F4", label: "Edit", onClick: () => runAction("edit"), disabled: !activeRow || activeIsPulls, reason: activeIsPulls ? prReason : undefined },
    { hotkey: "F5", label: `Copy${suffix}`, onClick: () => runAction("copy"), disabled: !footerRow || activeIsPulls || !copyRes.ok, reason: activeIsPulls ? prReason : copyRes.reason },
    { hotkey: "F6", label: `Move${suffix}`, onClick: () => runAction("move"), disabled: !footerRow || activeIsPulls || !moveRes.ok, reason: activeIsPulls ? prReason : moveRes.reason },
    {
      hotkey: "F7",
      label: "Fields",
      onClick: () => runAction("editIssue"),
      disabled: !activeRow || activeIsPulls,
      reason: activeIsPulls ? prReason : "Edit assignees · milestone · status · labels (Space)",
    },
    { hotkey: "F8", label: `Close${suffix}`, onClick: () => runAction("close"), disabled: !footerRow || activeIsPulls, reason: activeIsPulls ? prReason : undefined },
  ];

  if (!org) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded border border-destructive/40 bg-destructive/10 p-6 text-center">
          <h1 className="mb-2 font-mono text-sm font-semibold">GITHUB_ORG is not set</h1>
          <p className="text-xs text-muted-foreground">
            Add <code className="rounded bg-muted px-1">GITHUB_ORG=your-org</code> to{" "}
            <code className="rounded bg-muted px-1">.env.local</code> and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-secondary/50 px-4 py-2.5">
        <span className="font-mono text-base font-bold tracking-tight">Issue Commander</span>
        <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-sm text-primary">@{org}</span>
        <button
          type="button"
          onClick={() => useAppStore.getState().openNewIssue(null)}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-input px-2 py-1 font-mono text-xs text-foreground hover:bg-muted"
          title="New issue (Alt+Enter)"
        >
          <Plus className="size-3.5" />
          New <span className="opacity-50">Alt+Enter</span>
        </button>
        <span className="ml-auto hidden font-mono text-xs text-muted-foreground md:block">
          Tab switch · F1/F2 source · Ins select · ↑↓ navigate · Enter open · Alt+Enter new
        </span>
        <button
          type="button"
          onClick={() => useAppStore.getState().toggleMode()}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={displayMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={displayMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {displayMode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => useAppStore.getState().openSettings()}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Settings"
        >
          <Settings className="size-4" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-border">
        <Pane paneId="pane1" query={q1} previewTarget={previewTarget1} />
        <Pane paneId="pane2" query={q2} previewTarget={previewTarget2} />
      </div>

      <Footer keys={footerKeys} />

      <SourceSelector />
      <ConfirmDialog />
      <EditDialog />
      <QuickAssignPicker />
      <SettingsDialog />
    </div>
  );
}
