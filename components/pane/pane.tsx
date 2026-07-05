"use client";

import { useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { contextColumn } from "@/lib/source";
import { applyFilters, distinctAssignees, distinctBranches, distinctRepos, distinctStatuses, type SortField } from "@/lib/filters";
import { PaneHeader } from "@/components/pane/pane-header";
import { PaneFilterBar } from "@/components/pane/pane-filter-bar";
import { IssueTable } from "@/components/pane/issue-table";
import { IssuePreview } from "@/components/pane/issue-preview";
import { InlineEditor } from "@/components/pane/inline-editor";
import { NewIssueForm } from "@/components/new-issue-panel";
import { PaneLoading, PaneMessage } from "@/components/pane/pane-empty";
import { useAppStore, type PaneId } from "@/hooks/use-app-store";
import { useIssueActions } from "@/hooks/use-issue-mutations";
import type { IssuesQuery } from "@/hooks/use-issues";
import type { IssueRow, RepoRef } from "@/lib/types";

const PRELOAD_INTERVAL_MS = 5000;

interface PreviewTarget {
  repo: RepoRef;
  number: number;
  title: string;
  row: IssueRow;
}

export function Pane({
  paneId,
  query,
  previewTarget,
}: {
  paneId: PaneId;
  query: IssuesQuery;
  previewTarget: PreviewTarget | null;
}) {
  const active = useAppStore((s) => s.active === paneId);
  const pane = useAppStore((s) => s.panes[paneId]);
  const flashedKeys = useAppStore((s) => s.flashed[paneId]);
  const markedKeys = useAppStore((s) => s.selected[paneId]);
  const ops = useAppStore((s) => s.ops);
  const filter = useAppStore((s) => s.filters[paneId]);
  const setActive = useAppStore((s) => s.setActive);
  const setSelectedIndex = useAppStore((s) => s.setSelectedIndex);
  const setMode = useAppStore((s) => s.setMode);
  const setView = useAppStore((s) => s.setView);
  const openSelector = useAppStore((s) => s.openSelector);
  const setFilter = useAppStore((s) => s.setFilter);
  const clearFilter = useAppStore((s) => s.clearFilter);
  const actions = useIssueActions();

  const allRows = query.rows;
  const isPulls = pane.view === "pulls";
  const lastColumn = query.lastColumn ?? contextColumn(pane.source);
  const rows = useMemo(() => applyFilters(allRows, filter), [allRows, filter]);
  const assignees = useMemo(() => distinctAssignees(allRows), [allRows]);
  const repos = useMemo(() => distinctRepos(allRows), [allRows]);
  const statuses = useMemo(() => distinctStatuses(allRows), [allRows]);
  const branches = useMemo(() => (isPulls ? distinctBranches(allRows) : []), [allRows, isPulls]);

  // Background preload: pull the next page every few seconds until fully loaded.
  // The manual "load more" sentinel stays available if the user scrolls faster.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const t = setTimeout(fetchNextPage, PRELOAD_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, allRows.length]);
  // selectable indices include the trailing "load more" sentinel when there's a next page.
  const maxIndex = Math.max(0, rows.length - 1 + (query.hasNextPage ? 1 : 0));
  const clampedIndex = Math.min(pane.selectedIndex, maxIndex);

  const hotkey = paneId === "pane1" ? "F1" : "F2";

  // Stable callbacks so memoized rows don't re-render on every selection move.
  const handleSelect = useCallback(
    (i: number) => {
      setActive(paneId);
      setSelectedIndex(paneId, i);
    },
    [paneId, setActive, setSelectedIndex],
  );
  const handleOpen = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);
  // Header click cycles the column: asc → desc → off (back to source order).
  const handleSort = useCallback(
    (field: SortField) => {
      const patch =
        filter.sortBy !== field
          ? { sortBy: field, sortDir: "asc" as const }
          : filter.sortDir === "asc"
            ? { sortDir: "desc" as const }
            : { sortBy: "none" as const, sortDir: "asc" as const };
      setFilter(paneId, patch);
    },
    [paneId, setFilter, filter.sortBy, filter.sortDir],
  );

  function body() {
    if (pane.mode === "new") {
      return <NewIssueForm onClose={() => setMode(paneId, "list")} />;
    }
    if (pane.mode === "preview") {
      return previewTarget ? (
        <IssuePreview
          repo={previewTarget.repo}
          number={previewTarget.number}
          title={previewTarget.title}
          row={previewTarget.row}
        />
      ) : (
        <PaneMessage title="No issue selected" hint="Select an issue in the other pane to preview it." />
      );
    }
    if (pane.mode === "edit") {
      const target = previewTarget; // the other pane's cursor row (same as preview)
      return target ? (
        <InlineEditor
          repo={target.repo}
          number={target.number}
          title={target.title}
          onSave={async (newBody) => {
            const res = await actions.edit(target.repo.owner, target.repo.name, target.number, newBody);
            if (res) setMode(paneId, "list");
            return !!res;
          }}
          onCancel={() => setMode(paneId, "list")}
        />
      ) : (
        <PaneMessage title="No issue selected" hint="Select an issue in the other pane to edit it." />
      );
    }

    if (!pane.source) {
      return (
        <PaneMessage
          title="No source selected"
          hint={`Press ${hotkey} (or click the header) to choose a repository, milestone, or project.`}
          actionLabel="Choose source"
          onAction={() => openSelector(paneId)}
        />
      );
    }
    if (query.isLoading) return <PaneLoading />;
    if (query.isError) {
      return (
        <PaneMessage
          title="Failed to load issues"
          hint={(query.error as Error)?.message}
          actionLabel="Retry"
          onAction={query.refetch}
        />
      );
    }
    if (rows.length === 0) {
      const noun = isPulls ? "pull requests" : "issues";
      return allRows.length > 0 ? (
        <PaneMessage
          title="No matches"
          hint={`No loaded ${noun} match the current filter.`}
          actionLabel="Clear filter"
          onAction={() => clearFilter(paneId)}
        />
      ) : (
        <PaneMessage title={isPulls ? "No pull requests" : "No issues"} hint={`This source has no ${noun}.`} />
      );
    }

    return (
      <IssueTable
        rows={rows}
        paneId={paneId}
        lastColumn={lastColumn}
        view={pane.view}
        selectedIndex={clampedIndex}
        active={active}
        flashedKeys={flashedKeys}
        markedKeys={markedKeys}
        ops={ops}
        sortBy={filter.sortBy}
        sortDir={filter.sortDir}
        onSort={handleSort}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        onLoadMore={query.fetchNextPage}
        onSelect={handleSelect}
        onOpen={handleOpen}
      />
    );
  }

  return (
    <section
      onMouseDown={() => setActive(paneId)}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden border bg-card transition-colors",
        active ? "border-primary ring-1 ring-primary/40" : "border-border opacity-90",
      )}
    >
      {/* Preview/edit/new render content tied to the OTHER pane (each has its own header), so this
          pane's source header would be misleading — only show it in list mode. */}
      {pane.mode === "list" && (
        <PaneHeader
          source={pane.source}
          active={active}
          count={pane.source ? allRows.length : undefined}
          selectedCount={markedKeys.size}
          hotkey={hotkey}
          view={pane.view}
          showTabs={pane.source?.kind === "repo"}
          onViewChange={(v) => setView(paneId, v)}
          onOpenSelector={() => openSelector(paneId)}
        />
      )}
      {!!pane.source && pane.mode === "list" && allRows.length > 0 && (
        <PaneFilterBar
          filter={filter}
          assignees={assignees}
          repos={repos}
          statuses={statuses}
          branches={branches}
          showRepo={lastColumn === "repo"}
          view={pane.view}
          matchCount={rows.length}
          totalCount={allRows.length}
          onChange={(patch) => setFilter(paneId, patch)}
          onClear={() => clearFilter(paneId)}
        />
      )}
      <div className="min-h-0 flex-1">{body()}</div>
    </section>
  );
}
