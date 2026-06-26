import type { IssueRow, Label, ProjectStatus, RepoRef } from "@/lib/types";

export interface SingleSelectValue {
  __typename?: string;
  name?: string;
  optionId?: string;
}
export interface ProjectMeta {
  id: string;
  number: number;
  title: string;
}

// ---- REST (octokit.rest.issues.*) ----

export interface RestIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  node_id: string;
  assignees?: Array<{ login: string; avatar_url: string }> | null;
  labels?: Array<string | { name?: string | null; color?: string | null }>;
  milestone?: { number: number; title: string } | null;
  type?: { name?: string | null } | null;
  pull_request?: unknown;
}

function toLabel(l: string | { name?: string | null; color?: string | null }): Label | null {
  if (typeof l === "string") return { name: l, color: "888888" };
  if (!l.name) return null;
  return { name: l.name, color: l.color ?? "888888" };
}

export function mapRestIssue(issue: RestIssue, repo: RepoRef): IssueRow {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state === "closed" ? "closed" : "open",
    assignees: (issue.assignees ?? []).map((a) => ({ login: a.login, avatarUrl: a.avatar_url })),
    labels: (issue.labels ?? []).map(toLabel).filter((l): l is Label => l !== null),
    milestone: issue.milestone ? { number: issue.milestone.number, title: issue.milestone.title } : null,
    repo,
    htmlUrl: issue.html_url,
    nodeId: issue.node_id,
    type: issue.type?.name ?? null,
  };
}

/** A repo source lists issues; PRs come back from the same endpoint and must be dropped. */
export function isPullRequest(issue: RestIssue): boolean {
  return issue.pull_request != null;
}

// ---- REST search results (octokit.rest.search.issuesAndPullRequests) ----

export interface SearchIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  node_id: string;
  repository_url: string; // https://api.github.com/repos/{owner}/{name}
  assignees?: Array<{ login: string; avatar_url: string }> | null;
  labels?: Array<string | { name?: string | null; color?: string | null }>;
  milestone?: { number: number; title: string } | null;
  type?: { name?: string | null } | null;
  pull_request?: unknown;
}

export function mapSearchIssue(it: SearchIssue): IssueRow {
  const m = /repos\/([^/]+)\/([^/]+)$/.exec(it.repository_url);
  const owner = m?.[1] ?? "";
  const name = m?.[2] ?? "";
  return {
    number: it.number,
    title: it.title,
    state: it.state === "closed" ? "closed" : "open",
    assignees: (it.assignees ?? []).map((a) => ({ login: a.login, avatarUrl: a.avatar_url })),
    labels: (it.labels ?? []).map(toLabel).filter((l): l is Label => l !== null),
    milestone: it.milestone ? { number: it.milestone.number, title: it.milestone.title } : null,
    repo: { owner, name },
    htmlUrl: it.html_url,
    nodeId: it.node_id,
    type: it.type?.name ?? null,
  };
}

// ---- GraphQL (ProjectV2 item -> Issue content) ----

export interface GqlProjectIssue {
  id: string;
  number: number;
  title: string;
  state: string; // OPEN | CLOSED
  url: string;
  repository: { nameWithOwner: string };
  milestone: { number: number; title: string } | null;
  assignees: { nodes: Array<{ login: string; avatarUrl: string }> };
  labels: { nodes: Array<{ name: string; color: string }> };
  issueType?: { name: string } | null;
}

export function mapProjectIssue(
  issue: GqlProjectIssue,
  projectItemId: string,
  project: ProjectMeta,
  statusValue: SingleSelectValue | null,
): IssueRow {
  const [owner, name] = issue.repository.nameWithOwner.split("/");
  const projectStatus: ProjectStatus = {
    projectId: project.id,
    projectNumber: project.number,
    projectTitle: project.title,
    itemId: projectItemId,
    status: statusValue?.name ?? null,
    optionId: statusValue?.optionId ?? null,
  };
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state === "CLOSED" ? "closed" : "open",
    assignees: issue.assignees.nodes.map((a) => ({ login: a.login, avatarUrl: a.avatarUrl })),
    labels: issue.labels.nodes.map((l) => ({ name: l.name, color: l.color })),
    milestone: issue.milestone ? { number: issue.milestone.number, title: issue.milestone.title } : null,
    repo: { owner, name },
    htmlUrl: issue.url,
    nodeId: issue.id,
    type: issue.issueType?.name ?? null,
    projectItemId,
    projectStatus,
  };
}
