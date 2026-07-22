import { useQuery, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { readCache, readCacheTime, writeCache } from "@/lib/option-cache";

// Source lists (repos, projects, org milestones) change rarely — serve the
// localStorage copy instantly and only hit the network once it's this old.
const SOURCES_STALE = 15 * 60 * 1000;

/** localStorage-seeded query options: lists render instantly from the cached copy,
 * and the real timestamp means no network at all while the copy is still fresh. */
function cachedQuery<T>(key: string, fetcher: () => Promise<T>, staleTime: number = SOURCES_STALE) {
  return {
    queryKey: [key],
    queryFn: async () => {
      const data = await fetcher();
      writeCache(key, data);
      return data;
    },
    initialData: () => readCache<T>(key),
    initialDataUpdatedAt: () => readCacheTime(key),
    staleTime,
  };
}

export function useRepos(enabled: boolean) {
  return useQuery({ ...cachedQuery("repos", api.repos), enabled });
}

export function useProjects(enabled: boolean) {
  return useQuery({ ...cachedQuery("projects", api.projects), enabled });
}

export function useMilestones(enabled: boolean) {
  return useQuery({ ...cachedQuery("milestones", api.milestones), enabled });
}

export function useIssueTypes(enabled: boolean) {
  return useQuery({ ...cachedQuery("issueTypes", api.issueTypes), enabled });
}

/** The authenticated user's login — powers "@me" in the filter dialog. Never goes stale. */
export function useViewer(enabled: boolean) {
  return useQuery({ ...cachedQuery("viewer", api.viewer, Infinity), enabled });
}

/** Warm every source/option list in the background so F1/F2, F7, Settings and "@me"
 * open with data ready. The localStorage timestamps make this a no-op (per list)
 * while the cached copy is still fresh — nothing is re-fetched on every visit. */
export function prefetchSources(qc: QueryClient): void {
  void qc.prefetchQuery(cachedQuery("repos", api.repos));
  void qc.prefetchQuery(cachedQuery("projects", api.projects));
  void qc.prefetchQuery(cachedQuery("milestones", api.milestones));
  void qc.prefetchQuery(cachedQuery("issueTypes", api.issueTypes));
  void qc.prefetchQuery(cachedQuery("viewer", api.viewer, Infinity));
}
