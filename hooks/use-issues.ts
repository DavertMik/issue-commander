import { useCallback } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sourceKey, sourceToQuery } from "@/lib/source";
import { useAppStore } from "@/hooks/use-app-store";
import type { StateFilter } from "@/lib/filters";
import type { IssueRow, LastColumn, PaneSource, PaneView } from "@/lib/types";

/** Normalized shape consumers use — hides the infinite-query paging internals. */
export interface IssuesQuery {
  rows: IssueRow[];
  lastColumn: LastColumn | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function useIssues(
  source: PaneSource | null,
  state: StateFilter = "open",
  view: PaneView = "issues",
): IssuesQuery {
  // The default project decides which project's Status enrichment attaches (repo/milestone/recent panes).
  const preferredProject = useAppStore((s) => s.config.defaultProject);
  // PR rows have no project Status column, so skip the enrichment for the pulls view.
  const usePreferred = preferredProject != null && source?.kind !== "project" && view !== "pulls";
  const q = useInfiniteQuery({
    queryKey: ["issues", sourceKey(source, state, view), usePreferred ? preferredProject : null],
    queryFn: ({ pageParam }) =>
      api.listIssues({
        ...sourceToQuery(source as PaneSource, state, view),
        ...(usePreferred ? { preferredProject: String(preferredProject) } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    enabled: !!source,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.pageInfo?.hasNextPage ? (last.pageInfo.endCursor ?? undefined) : undefined),
    placeholderData: keepPreviousData,
  });

  // Stable refs so the auto-preload timer (deps include fetchNextPage) isn't reset every render.
  const { fetchNextPage: fnp, refetch: rf } = q;
  const fetchNextPage = useCallback(() => void fnp(), [fnp]);
  const refetch = useCallback(() => void rf(), [rf]);

  return {
    rows: q.data?.pages.flatMap((p) => p.rows) ?? [],
    lastColumn: q.data?.pages[0]?.lastColumn ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    refetch,
    hasNextPage: !!q.hasNextPage,
    isFetchingNextPage: q.isFetchingNextPage,
    fetchNextPage,
  };
}
