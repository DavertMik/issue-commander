import { getOctokit } from "./client";
import { ApiError } from "./errors";
import {
  ADD_PROJECT_ITEM_MUTATION,
  DELETE_PROJECT_ITEM_MUTATION,
  ENRICH_STATUS_QUERY,
  ISSUE_RELATIONS_QUERY,
  ORG_MILESTONES_QUERY,
  ORG_PROJECTS_QUERY,
  PROJECT_ID_QUERY,
  PROJECT_ITEMS_QUERY,
  REPO_ID_QUERY,
  STATUS_FIELD_QUERY,
  TRANSFER_ISSUE_MUTATION,
  UPDATE_ITEM_STATUS_MUTATION,
} from "./queries";
import { type GqlProjectIssue, mapProjectIssue, type SingleSelectValue } from "@/lib/domain/mappers";
import type { IssueRow, LinkedRef, MilestoneOption, PageInfo, ProjectOption, ProjectStatus, RelatedIssue } from "@/lib/types";

function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  return getOctokit().graphql<T>(query, variables);
}

export async function resolveProjectId(org: string, number: number): Promise<{ id: string; title: string }> {
  const data = await gql<{ organization: { projectV2: { id: string; title: string } | null } | null }>(
    PROJECT_ID_QUERY,
    { login: org, number },
  );
  const proj = data.organization?.projectV2;
  if (!proj) throw new ApiError("PROJECT_NOT_FOUND", 404, `Project #${number} not found in @${org}.`);
  return proj;
}

interface ProjectItemsResponse {
  node: {
    title: string;
    number: number;
    items: {
      pageInfo: PageInfo;
      nodes: Array<{
        id: string;
        type: string;
        fieldValueByName: SingleSelectValue | null;
        content: ({ __typename: string } & Partial<GqlProjectIssue>) | null;
      }>;
    };
  } | null;
}

export async function listProjectItems(
  projectId: string,
  cursor?: string,
): Promise<{ title: string; rows: IssueRow[]; pageInfo: PageInfo; skippedDrafts: number }> {
  const data = await gql<ProjectItemsResponse>(PROJECT_ITEMS_QUERY, { projectId, cursor: cursor ?? null });
  if (!data.node) throw new ApiError("PROJECT_NOT_FOUND", 404, "Project not found.");

  const project = { id: projectId, number: data.node.number, title: data.node.title };
  const rows: IssueRow[] = [];
  let skippedDrafts = 0;
  for (const item of data.node.items.nodes) {
    if (item.content?.__typename === "Issue") {
      rows.push(mapProjectIssue(item.content as GqlProjectIssue, item.id, project, item.fieldValueByName));
    } else {
      skippedDrafts++;
    }
  }
  return { title: data.node.title, rows, pageInfo: data.node.items.pageInfo, skippedDrafts };
}

interface EnrichResponse {
  nodes: Array<{
    id: string;
    projectItems: {
      nodes: Array<{
        id: string;
        project: { id: string; number: number; title: string } | null;
        fieldValueByName: SingleSelectValue | null;
      }>;
    };
  } | null>;
}

/**
 * Map issue node id -> its project Status (for repo/milestone panes). Prefers the issue's item in
 * `preferredProjectNumber` (the user's default project) when present, else falls back to its first project.
 */
export async function enrichProjectStatus(
  issueNodeIds: string[],
  preferredProjectNumber?: number | null,
): Promise<Map<string, ProjectStatus>> {
  const out = new Map<string, ProjectStatus>();
  if (issueNodeIds.length === 0) return out;
  const data = await gql<EnrichResponse>(ENRICH_STATUS_QUERY, { ids: issueNodeIds });
  for (const node of data.nodes) {
    if (!node) continue;
    const items = node.projectItems.nodes.filter((it) => it.project);
    if (items.length === 0) continue;
    const preferred =
      preferredProjectNumber != null ? items.find((it) => it.project!.number === preferredProjectNumber) : undefined;
    const chosen = preferred ?? items[0];
    out.set(node.id, {
      projectId: chosen.project!.id,
      projectNumber: chosen.project!.number,
      projectTitle: chosen.project!.title,
      itemId: chosen.id,
      status: chosen.fieldValueByName?.name ?? null,
      optionId: chosen.fieldValueByName?.optionId ?? null,
      multiple: items.length > 1,
    });
  }
  return out;
}

export interface StatusField {
  fieldId: string;
  options: Array<{ id: string; name: string }>;
}

export async function getStatusField(projectId: string): Promise<StatusField | null> {
  const data = await gql<{
    node: { field: { id: string; options: Array<{ id: string; name: string }> } | null } | null;
  }>(STATUS_FIELD_QUERY, { projectId });
  const field = data.node?.field;
  if (!field) return null;
  return { fieldId: field.id, options: field.options };
}

export async function setItemStatus(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
): Promise<void> {
  await gql(UPDATE_ITEM_STATUS_MUTATION, { projectId, itemId, fieldId, optionId });
}

export async function listOrgProjects(org: string): Promise<ProjectOption[]> {
  const out: ProjectOption[] = [];
  let cursor: string | null = null;
  // Paginate fully — orgs rarely have hundreds of projects.
  do {
    const data: {
      organization: {
        projectsV2: { pageInfo: PageInfo; nodes: Array<{ id: string; number: number; title: string }> };
      } | null;
    } = await gql(ORG_PROJECTS_QUERY, { login: org, cursor });
    const conn = data.organization?.projectsV2;
    if (!conn) break;
    out.push(...conn.nodes);
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (cursor);
  return out;
}

interface OrgMilestonesResponse {
  organization: {
    repositories: {
      pageInfo: PageInfo;
      nodes: Array<{ milestones: { nodes: Array<{ title: string }> } }>;
    };
  } | null;
}

/** Aggregate distinct OPEN milestone titles across all org repos (one paginated query). */
export async function listOrgMilestones(org: string): Promise<MilestoneOption[]> {
  const byTitle = new Map<string, MilestoneOption>();
  let cursor: string | null = null;
  do {
    const data: OrgMilestonesResponse = await gql(ORG_MILESTONES_QUERY, { login: org, cursor });
    const conn = data.organization?.repositories;
    if (!conn) break;
    for (const repo of conn.nodes) {
      for (const m of repo.milestones.nodes) {
        const cur = byTitle.get(m.title) ?? { title: m.title, repoCount: 0, openIssues: 0, closedIssues: 0 };
        cur.repoCount += 1;
        byTitle.set(m.title, cur);
      }
    }
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (cursor);

  return [...byTitle.values()].sort((a, b) => b.repoCount - a.repoCount || a.title.localeCompare(b.title));
}

interface GqlRel {
  number: number;
  title: string;
  state: string;
  url: string;
  repository: { nameWithOwner: string };
}

const toRelated = (r: GqlRel): RelatedIssue => ({
  number: r.number,
  title: r.title,
  state: r.state === "CLOSED" ? "closed" : "open",
  url: r.url,
  repo: r.repository.nameWithOwner,
});

interface GqlLinked {
  __typename?: string;
  number: number;
  title: string;
  url: string;
  state: string; // OPEN | CLOSED | MERGED
  repository: { nameWithOwner: string };
}

const toLinked = (n: GqlLinked, isPR: boolean): LinkedRef => ({
  number: n.number,
  title: n.title,
  url: n.url,
  repo: n.repository.nameWithOwner,
  state: n.state === "MERGED" ? "merged" : n.state === "CLOSED" ? "closed" : "open",
  isPR,
});

/** Parent + sub-issues + linked PRs/cross-references for an issue (F3 preview). */
export async function getIssueRelations(
  owner: string,
  repo: string,
  number: number,
): Promise<{ parent: RelatedIssue | null; children: RelatedIssue[]; linked: LinkedRef[] }> {
  const data = await gql<{
    repository: {
      issue: {
        parent: GqlRel | null;
        subIssues: { nodes: GqlRel[] };
        closedByPullRequestsReferences: { nodes: GqlLinked[] };
        timelineItems: { nodes: Array<{ source?: GqlLinked | null }> };
      } | null;
    } | null;
  }>(ISSUE_RELATIONS_QUERY, { owner, repo, number });
  const issue = data.repository?.issue;

  const linked = new Map<string, LinkedRef>();
  for (const pr of issue?.closedByPullRequestsReferences.nodes ?? []) linked.set(pr.url, toLinked(pr, true));
  for (const t of issue?.timelineItems.nodes ?? []) {
    if (t.source) linked.set(t.source.url, toLinked(t.source, t.source.__typename === "PullRequest"));
  }

  return {
    parent: issue?.parent ? toRelated(issue.parent) : null,
    children: (issue?.subIssues.nodes ?? []).map(toRelated),
    linked: [...linked.values()],
  };
}

export async function resolveRepoId(owner: string, name: string): Promise<string> {
  const data = await gql<{ repository: { id: string } | null }>(REPO_ID_QUERY, { owner, name });
  if (!data.repository) throw new ApiError("REPO_NOT_FOUND", 404, `Repository ${owner}/${name} not found.`);
  return data.repository.id;
}

export async function transferIssue(
  issueId: string,
  repositoryId: string,
): Promise<{ id: string; number: number; url: string; nameWithOwner: string }> {
  const data = await gql<{
    transferIssue: { issue: { id: string; number: number; url: string; repository: { nameWithOwner: string } } };
  }>(TRANSFER_ISSUE_MUTATION, { input: { issueId, repositoryId } });
  const issue = data.transferIssue.issue;
  return { id: issue.id, number: issue.number, url: issue.url, nameWithOwner: issue.repository.nameWithOwner };
}

export async function addProjectItem(projectId: string, contentId: string): Promise<string> {
  const data = await gql<{ addProjectV2ItemById: { item: { id: string } } }>(ADD_PROJECT_ITEM_MUTATION, {
    input: { projectId, contentId },
  });
  return data.addProjectV2ItemById.item.id;
}

export async function deleteProjectItem(projectId: string, itemId: string): Promise<string> {
  const data = await gql<{ deleteProjectV2Item: { deletedItemId: string } }>(DELETE_PROJECT_ITEM_MUTATION, {
    input: { projectId, itemId },
  });
  return data.deleteProjectV2Item.deletedItemId;
}
