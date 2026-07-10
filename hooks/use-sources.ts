import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const SOURCES_STALE = 5 * 60 * 1000;

export function useRepos(enabled: boolean) {
  return useQuery({ queryKey: ["repos"], queryFn: api.repos, enabled, staleTime: SOURCES_STALE });
}

export function useProjects(enabled: boolean) {
  return useQuery({ queryKey: ["projects"], queryFn: api.projects, enabled, staleTime: SOURCES_STALE });
}

export function useMilestones(enabled: boolean) {
  return useQuery({ queryKey: ["milestones"], queryFn: api.milestones, enabled, staleTime: SOURCES_STALE });
}

export function useIssueTypes(enabled: boolean) {
  return useQuery({ queryKey: ["issueTypes"], queryFn: api.issueTypes, enabled, staleTime: SOURCES_STALE });
}

/** The authenticated user's login — powers "@me" in the filter dialog. Never goes stale. */
export function useViewer(enabled: boolean) {
  return useQuery({ queryKey: ["viewer"], queryFn: api.viewer, enabled, staleTime: Infinity });
}
