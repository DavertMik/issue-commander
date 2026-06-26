import { getOctokit } from "@/lib/github/client";
import { getOrg } from "@/lib/github/org";
import { cached } from "@/lib/github/cache";
import { listOrgMilestones, listOrgProjects } from "@/lib/github/graphql";
import type { MilestoneOption, ProjectOption, RepoOption, RepoOptions } from "@/lib/types";

const TTL = 2 * 60 * 1000;

export function listRepos(): Promise<RepoOption[]> {
  const org = getOrg();
  return cached(`repos:${org}`, TTL, async () => {
    const octokit = getOctokit();
    const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
      org,
      per_page: 100,
      sort: "pushed",
    });
    return repos.map((r) => ({ owner: org, name: r.name, private: r.private }));
  });
}

/**
 * Aggregate distinct milestone titles across every org repo. Milestones are
 * repo-scoped in GitHub, but teams reuse the same title across repos. Uses one
 * paginated GraphQL query (not a per-repo REST fan-out, which overwhelmed the
 * dev async-hooks instrumentation and was slow).
 */
export function listMilestones(): Promise<MilestoneOption[]> {
  const org = getOrg();
  return cached(`milestones:${org}`, TTL, () => listOrgMilestones(org));
}

export function listProjects(): Promise<ProjectOption[]> {
  const org = getOrg();
  return cached(`projects:${org}`, TTL, () => listOrgProjects(org));
}

/** Assignable users, labels, and open milestones for a repo (F7 quick-edit). */
export function listRepoOptions(repo: string): Promise<RepoOptions> {
  const org = getOrg();
  return cached(`repoOptions:${org}/${repo}`, TTL, async () => {
    const octokit = getOctokit();
    const [assignees, labels, milestones] = await Promise.all([
      octokit.paginate(octokit.rest.issues.listAssignees, { owner: org, repo, per_page: 100 }),
      octokit.paginate(octokit.rest.issues.listLabelsForRepo, { owner: org, repo, per_page: 100 }),
      octokit.paginate(octokit.rest.issues.listMilestones, { owner: org, repo, state: "open", per_page: 100 }),
    ]);
    return {
      assignees: assignees.map((a) => ({ login: a.login, avatarUrl: a.avatar_url })),
      labels: labels.map((l) => ({ name: l.name, color: l.color })),
      milestones: milestones.map((m) => ({ number: m.number, title: m.title })),
    };
  });
}
