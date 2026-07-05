import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RepoRef } from "@/lib/types";

export function useIssueDetail(repo: RepoRef | null, number: number | null, isPr = false) {
  return useQuery({
    // A number is either an issue or a PR (never both), so isPr need not be part of the key.
    queryKey: ["issueDetail", repo?.owner, repo?.name, number],
    queryFn: () => api.issueDetail(repo!.owner, repo!.name, number!, isPr),
    enabled: !!repo && number != null,
    // Keep the current ticket visible while the next one loads in the background (no skeleton flash).
    placeholderData: keepPreviousData,
  });
}
