import { getOctokit } from "@/lib/github/client";
import { getOrg } from "@/lib/github/org";
import { enrichProjectStatus, listProjectItems, resolveProjectId } from "@/lib/github/graphql";
import { isPullRequest, mapRestIssue, mapSearchIssue, type RestIssue, type SearchIssue } from "@/lib/domain/mappers";
import type { ListIssuesQuery } from "@/lib/validation/schemas";
import type { IssueRow, IssueState, PaneListResult } from "@/lib/types";

const PER_PAGE = 100;

/** Attach each issue's project Status (preferred project, else first) for repo/milestone panes. */
async function withProjectStatus(rows: IssueRow[], preferredProject?: number | null): Promise<IssueRow[]> {
  if (rows.length === 0) return rows;
  const statuses = await enrichProjectStatus(
    rows.map((r) => r.nodeId),
    preferredProject,
  );
  for (const r of rows) r.projectStatus = statuses.get(r.nodeId) ?? null;
  return rows;
}

/** REST uses page numbers; we encode the next page as the cursor string for a uniform API. */
function restPageInfo(page: number, count: number) {
  const hasNextPage = count === PER_PAGE;
  return { hasNextPage, endCursor: hasNextPage ? String(page + 1) : null };
}

function asState(state: "open" | "closed" | "all"): IssueState | undefined {
  return state === "all" ? undefined : state;
}

export async function listIssues(query: ListIssuesQuery): Promise<PaneListResult> {
  const owner = getOrg();
  const octokit = getOctokit();

  if (query.kind === "repo") {
    const state = query.state ?? "open";
    const page = query.cursor ? parseInt(query.cursor, 10) : 1;
    const res = await octokit.rest.issues.listForRepo({ owner, repo: query.repo, state, per_page: PER_PAGE, page });
    const issues = res.data as unknown as RestIssue[];
    const rows = issues.filter((i) => !isPullRequest(i)).map((i) => mapRestIssue(i, { owner, name: query.repo }));
    return {
      rows: await withProjectStatus(rows, query.preferredProject),
      lastColumn: "milestone",
      source: { kind: "repo", repo: query.repo, state: asState(state) },
      pageInfo: restPageInfo(page, issues.length),
    };
  }

  if (query.kind === "milestone") {
    // Org-wide milestone by title — aggregate across repos via the Search API.
    const state = query.state ?? "open";
    const page = query.cursor ? parseInt(query.cursor, 10) : 1;
    const stateQ = state === "all" ? "" : ` state:${state}`;
    const q = `org:${owner} is:issue milestone:"${query.title.replace(/"/g, '\\"')}"${stateQ}`;
    const res = await octokit.rest.search.issuesAndPullRequests({
      q,
      per_page: PER_PAGE,
      page,
      advanced_search: "true",
    });
    const items = res.data.items as unknown as SearchIssue[];
    const rows = items.map(mapSearchIssue);
    const hasNextPage = items.length === PER_PAGE && page * PER_PAGE < res.data.total_count;
    return {
      rows: await withProjectStatus(rows, query.preferredProject),
      lastColumn: "repo",
      source: { kind: "milestone", title: query.title },
      pageInfo: { hasNextPage, endCursor: hasNextPage ? String(page + 1) : null },
    };
  }

  if (query.kind === "recent") {
    // Issues you're involved in, most-recently-updated first (Search API).
    const state = query.state ?? "open";
    const page = query.cursor ? parseInt(query.cursor, 10) : 1;
    const stateQ = state === "all" ? "" : ` state:${state}`;
    const q = `org:${owner} is:issue involves:@me${stateQ}`;
    const res = await octokit.rest.search.issuesAndPullRequests({
      q,
      sort: "updated",
      order: "desc",
      per_page: PER_PAGE,
      page,
      advanced_search: "true",
    });
    const items = res.data.items as unknown as SearchIssue[];
    const rows = items.map(mapSearchIssue);
    const hasNextPage = items.length === PER_PAGE && page * PER_PAGE < res.data.total_count;
    return {
      rows: await withProjectStatus(rows, query.preferredProject),
      lastColumn: "repo",
      source: { kind: "recent" },
      pageInfo: { hasNextPage, endCursor: hasNextPage ? String(page + 1) : null },
    };
  }

  // kind === "project"
  const { id, title } = await resolveProjectId(owner, query.projectNumber);
  const { rows, pageInfo, skippedDrafts } = await listProjectItems(id, query.cursor);
  return {
    rows,
    lastColumn: "repo",
    source: { kind: "project", projectNumber: query.projectNumber, projectId: id, projectTitle: title },
    pageInfo,
    skippedDrafts,
  };
}
