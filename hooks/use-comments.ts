import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RepoRef } from "@/lib/types";

export function useIssueDetail(repo: RepoRef | null, number: number | null) {
  return useQuery({
    queryKey: ["issueDetail", repo?.owner, repo?.name, number],
    queryFn: () => api.issueDetail(repo!.owner, repo!.name, number!),
    enabled: !!repo && number != null,
    // Keep the current ticket visible while the next one loads in the background (no skeleton flash).
    placeholderData: keepPreviousData,
  });
}
