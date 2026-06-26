import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { readCache, writeCache } from "@/lib/option-cache";
import type { RepoOptions } from "@/lib/types";

export function useRepoOptions(repo: string | null) {
  return useQuery({
    queryKey: ["repoOptions", repo],
    queryFn: async () => {
      const data = await api.repoOptions(repo as string);
      writeCache(`repo:${repo}`, data);
      return data;
    },
    enabled: !!repo,
    // Seed from localStorage so options show instantly; refetch in the background.
    initialData: () => (repo ? readCache<RepoOptions>(`repo:${repo}`) : undefined),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
}
