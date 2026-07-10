"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleCheck,
  CircleDot,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LabelBadges } from "@/components/labels";
import { AssigneeAvatars } from "@/components/assignees";
import { TimeLabel } from "@/components/time-label";
import { prStatus } from "@/lib/source";
import type { OpStatus, PaneId } from "@/hooks/use-app-store";
import type { SortDir, SortField } from "@/lib/filters";
import type { IssueRow, IssueState, LastColumn, PaneView, ProjectStatus } from "@/lib/types";

function OpIcon({ op }: { op: OpStatus }) {
  if (op === "pending") return <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />;
  if (op === "done") return <Check className="size-3.5 shrink-0 text-emerald-400" />;
  return <X className="size-3.5 shrink-0 text-destructive" />;
}

const GRID_CLASS = "grid items-center gap-2.5 px-3";
// Column widths come from a CSS variable so resizing never re-renders the rows.
const GRID_STYLE: React.CSSProperties = { gridTemplateColumns: "var(--tc-cols)" };

// All columns are fixed-width and resizable; the trailing context column flexes to fill.
type ColKey = "number" | "title" | "assignee" | "labels" | "status" | "opened";
const DEFAULT_WIDTHS: Record<ColKey, number> = { number: 96, title: 340, assignee: 116, labels: 184, status: 116, opened: 120 };

function templateFrom(w: Record<ColKey, number>): string {
  return `${w.number}px ${w.title}px ${w.assignee}px ${w.labels}px ${w.status}px ${w.opened}px minmax(6rem,1fr)`;
}

function StateIcon({ state }: { state: IssueState }) {
  return state === "closed" ? (
    <CircleCheck className="size-4 shrink-0 text-violet-400" />
  ) : (
    <CircleDot className="size-4 shrink-0 text-emerald-400" />
  );
}

/** PR-flavored status icon for the # column: draft > merged > closed > open. */
function PrStateIcon({ row }: { row: IssueRow }) {
  if (row.pr?.draft && !row.pr.merged && row.state === "open")
    return <GitPullRequestDraft className="size-4 shrink-0 text-muted-foreground" />;
  const s = prStatus(row);
  if (s === "merged") return <GitMerge className="size-4 shrink-0 text-violet-400" />;
  if (s === "closed") return <GitPullRequestClosed className="size-4 shrink-0 text-rose-400" />;
  return <GitPullRequest className="size-4 shrink-0 text-emerald-400" />;
}

/** Target branch (base ref) for a PR, e.g. "→ master". */
function BranchCell({ row }: { row: IssueRow }) {
  const base = row.pr?.baseRef;
  if (!base) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-1 truncate font-mono text-xs" title={`${row.pr?.headRef ?? ""} → ${base}`}>
      <GitMerge className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground/80">{base}</span>
    </span>
  );
}

function StatusCell({ ps }: { ps?: ProjectStatus | null }) {
  if (!ps) return <span className="text-muted-foreground">—</span>;
  const title = ps.multiple ? `${ps.projectTitle} (+ other projects)` : ps.projectTitle;
  return (
    <span className="flex items-center gap-1.5 truncate" title={title}>
      <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
      <span className={cn("truncate", ps.status ? "text-foreground/80" : "text-muted-foreground italic")}>
        {ps.status ?? "no status"}
      </span>
      {ps.multiple && <span className="shrink-0 text-[10px] text-muted-foreground">+</span>}
    </span>
  );
}

interface RowProps {
  row: IssueRow;
  index: number;
  lastColumn: LastColumn;
  view: PaneView;
  selected: boolean;
  active: boolean;
  flashed: boolean;
  marked: boolean;
  op?: OpStatus;
  onSelect: (index: number) => void;
  onOpen: (url: string) => void;
}

// Memoized so Up/Down only re-renders the two rows whose `selected` changed.
const Row = memo(function Row({ row, index, lastColumn, view, selected, active, flashed, marked, op, onSelect, onOpen }: RowProps) {
  const isPr = view === "pulls";
  return (
    <div
      data-index={index}
      onClick={() => onSelect(index)}
      onDoubleClick={() => onOpen(row.htmlUrl)}
      style={GRID_STYLE}
      className={cn(
        GRID_CLASS,
        "h-9 cursor-default overflow-hidden border-l-[3px] border-transparent",
        selected && active && "border-l-primary bg-primary/25 text-foreground",
        selected && !active && "bg-muted",
        !selected && !marked && "hover:bg-muted/40",
        marked && "bg-yellow-400/30", // regular Ins selection
        marked && selected && active && "bg-yellow-400/50", // the active (cursor) selected row
        flashed && "bg-amber-400/20 ring-2 ring-inset ring-amber-400/70",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-start gap-1 font-mono text-sm tabular-nums",
          row.state === "closed" && !isPr ? "text-muted-foreground" : "text-primary/90",
        )}
      >
        {isPr ? <PrStateIcon row={row} /> : <StateIcon state={row.state} />}
        <span className="truncate">{row.number}</span>
      </div>
      <div className="flex items-center gap-1.5 overflow-hidden text-sm" title={row.title}>
        {op && <OpIcon op={op} />}
        <span className={cn("truncate", row.state === "closed" && !isPr && "text-muted-foreground")}>{row.title}</span>
      </div>
      <div className="overflow-hidden">
        {/* PRs show their author here (assignees carries the real assignees for F7/Ctrl+U). */}
        <AssigneeAvatars assignees={isPr ? (row.pr?.author ? [row.pr.author] : []) : row.assignees} />
      </div>
      <div className="overflow-hidden">
        <LabelBadges labels={row.labels} />
      </div>
      <div className="overflow-hidden text-sm">
        {isPr ? <BranchCell row={row} /> : <StatusCell ps={row.projectStatus} />}
      </div>
      <div className="flex items-center overflow-hidden text-sm text-muted-foreground">
        <TimeLabel iso={row.createdAt} className="cursor-pointer truncate text-xs hover:text-foreground hover:underline" />
      </div>
      <div className="flex items-center overflow-hidden truncate text-sm text-muted-foreground">
        {isPr ? (
          row.pr?.mergedAt ? (
            <TimeLabel iso={row.pr.mergedAt} className="cursor-pointer truncate text-xs hover:text-foreground hover:underline" />
          ) : (
            "—"
          )
        ) : lastColumn === "milestone" ? (
          (row.milestone?.title ?? "—")
        ) : (
          row.repo.name
        )}
      </div>
    </div>
  );
});

interface Props {
  rows: IssueRow[];
  paneId: PaneId;
  lastColumn: LastColumn;
  view: PaneView;
  selectedIndex: number;
  active: boolean;
  flashedKeys: Set<string>;
  markedKeys: Set<string>;
  ops: Record<string, OpStatus>;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onSelect: (index: number) => void;
  onOpen: (url: string) => void;
}

// `resizes` is the column adjusted by THIS cell's left-edge handle (the column to its left).
// `sort` makes the title a clickable sort toggle (click cycles asc → desc → off).
function HeaderCell({
  label,
  resizes,
  onResize,
  sort,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  resizes?: ColKey;
  onResize?: (e: React.MouseEvent, key: ColKey) => void;
  sort?: SortField;
  sortBy?: SortField;
  sortDir?: SortDir;
  onSort?: (field: SortField) => void;
}) {
  const sortable = !!(sort && onSort);
  const activeSort = sortable && sortBy === sort;
  return (
    <div className="relative flex items-center truncate">
      {resizes && onResize && (
        <div
          onMouseDown={(e) => onResize(e, resizes)}
          className="group absolute -left-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize items-stretch justify-center"
          title="Drag to resize"
        >
          <div className="w-px bg-border transition-colors group-hover:bg-primary" />
        </div>
      )}
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(sort)}
          title={`Sort by ${label}`}
          className={cn(
            "flex min-w-0 items-center gap-1 outline-none transition-colors hover:text-foreground",
            activeSort && "text-foreground",
          )}
        >
          <span className="truncate">{label}</span>
          {activeSort &&
            (sortDir === "asc" ? (
              <ArrowUp className="size-3 shrink-0 text-primary" />
            ) : (
              <ArrowDown className="size-3 shrink-0 text-primary" />
            ))}
        </button>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </div>
  );
}

export function IssueTable({
  rows,
  paneId,
  lastColumn,
  view,
  selectedIndex,
  active,
  flashedKeys,
  markedKeys,
  ops,
  sortBy,
  sortDir,
  onSort,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onSelect,
  onOpen,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<Record<ColKey, number>>(DEFAULT_WIDTHS);

  useEffect(() => {
    scrollRef.current?.querySelector(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, rows]);

  const handleSelect = useCallback((i: number) => onSelect(i), [onSelect]);
  const handleOpen = useCallback((url: string) => onOpen(url), [onOpen]);

  const startResize = useCallback((e: React.MouseEvent, key: ColKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    let startW = 0;
    setWidths((w) => {
      startW = w[key];
      return w;
    });
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(56, startW + ev.clientX - startX);
      setWidths((w) => ({ ...w, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const loadMoreIndex = rows.length;
  const loadMoreSelected = hasNextPage && selectedIndex === loadMoreIndex;

  return (
    <div className="flex h-full flex-col" style={{ ["--tc-cols" as string]: templateFrom(widths) } as React.CSSProperties}>
      <div
        style={GRID_STYLE}
        className={cn(
          GRID_CLASS,
          "h-8 shrink-0 border-b border-border bg-muted/50 font-mono text-xs uppercase tracking-wider text-muted-foreground",
        )}
      >
        <HeaderCell label="#" sort="number" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        <HeaderCell label="Title" resizes="number" onResize={startResize} sort="title" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        <HeaderCell label={view === "pulls" ? "Author" : "Assignee"} resizes="title" onResize={startResize} sort="assignee" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        <HeaderCell label="Labels" resizes="assignee" onResize={startResize} />
        <HeaderCell
          label={view === "pulls" ? "Branch" : "Status"}
          resizes="labels"
          onResize={startResize}
          sort={view === "pulls" ? undefined : "status"}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
        <HeaderCell label="Opened" resizes="status" onResize={startResize} sort="created" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        <HeaderCell
          label={view === "pulls" ? "Merged" : lastColumn === "milestone" ? "Milestone" : "Repo"}
          resizes="opened"
          onResize={startResize}
          sort={view !== "pulls" && lastColumn === "repo" ? "repo" : undefined}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>

      <div ref={scrollRef} data-pane={paneId} className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row, i) => (
          <Row
            key={`${row.repo.name}#${row.number}`}
            row={row}
            index={i}
            lastColumn={lastColumn}
            view={view}
            selected={i === selectedIndex}
            active={active}
            flashed={flashedKeys.has(`${row.repo.name}#${row.number}`)}
            marked={markedKeys.has(`${row.repo.name}#${row.number}`)}
            op={ops[`${row.repo.name}#${row.number}`]}
            onSelect={handleSelect}
            onOpen={handleOpen}
          />
        ))}

        {hasNextPage && (
          <div
            data-index={loadMoreIndex}
            onClick={() => onLoadMore()}
            className={cn(
              "flex h-9 cursor-pointer items-center justify-center gap-2 border-l-[3px] border-transparent font-mono text-sm text-muted-foreground transition-colors hover:bg-muted/40",
              loadMoreSelected && active && "border-l-primary bg-primary/25 text-foreground",
              loadMoreSelected && !active && "bg-muted",
            )}
          >
            {isFetchingNextPage ? "Loading…" : "··· load more ···"}
          </div>
        )}
      </div>
    </div>
  );
}
