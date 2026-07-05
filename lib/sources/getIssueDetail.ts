import { getOctokit } from "@/lib/github/client";
import { getIssueRelations } from "@/lib/github/graphql";
import type { IssueComment, IssueDetail, RelatedIssue } from "@/lib/types";

type RawComment = { user?: { login?: string; avatar_url?: string } | null; body?: string | null; created_at: string };
const mapComment = (c: RawComment): IssueComment => ({
  author: c.user?.login ?? "ghost",
  authorAvatarUrl: c.user?.avatar_url ?? "",
  body: c.body ?? "",
  createdAt: c.created_at,
});

// GitHub issue/PR URLs referenced anywhere in the body or comments.
const MENTION_RE = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)/g;
const MAX_MENTIONS = 20; // cap the fan-out of follow-up fetches

/** Parse body/comment text for github.com issue/PR links and resolve them to rows. */
async function findMentionedIssues(
  octokit: ReturnType<typeof getOctokit>,
  texts: Array<string | null | undefined>,
  exclude: Set<string>,
): Promise<RelatedIssue[]> {
  const seen = new Set<string>();
  const refs: Array<{ owner: string; repo: string; number: number }> = [];
  for (const text of texts) {
    if (!text) continue;
    for (const m of text.matchAll(MENTION_RE)) {
      const owner = m[1];
      const repo = m[2];
      const number = parseInt(m[3], 10);
      const key = `${owner}/${repo}#${number}`;
      if (exclude.has(key) || seen.has(key)) continue;
      seen.add(key);
      refs.push({ owner, repo, number });
    }
  }
  const rows = await Promise.all(
    refs.slice(0, MAX_MENTIONS).map(async (r): Promise<RelatedIssue | null> => {
      try {
        const { data: i } = await octokit.rest.issues.get({ owner: r.owner, repo: r.repo, issue_number: r.number });
        return {
          number: i.number,
          title: i.title,
          state: i.state === "closed" ? "closed" : "open",
          url: i.html_url,
          repo: `${r.owner}/${r.repo}`,
          isPR: i.pull_request != null,
        };
      } catch {
        return null; // private / deleted / unauthorized — skip silently
      }
    }),
  );
  return rows.filter((x): x is RelatedIssue => x !== null);
}

export async function getIssueDetail(
  owner: string,
  repo: string,
  number: number,
  isPr = false,
): Promise<IssueDetail> {
  const octokit = getOctokit();

  // PRs: the issue-relations GraphQL query hard-errors on a PR number, and PRs carry extra
  // stats. Use pulls.get (body/author/state + commits/files/diff) plus the shared issue-comments
  // endpoint (the PR conversation, no review/code comments). No sub-issue relations for PRs.
  if (isPr) {
    const [prRes, comments] = await Promise.all([
      octokit.rest.pulls.get({ owner, repo, pull_number: number }),
      octokit.paginate(octokit.rest.issues.listComments, { owner, repo, issue_number: number, per_page: 100 }),
    ]);
    const pr = prRes.data;
    const mentioned = await findMentionedIssues(
      octokit,
      [pr.body, ...comments.map((c) => c.body)],
      new Set([`${owner}/${repo}#${number}`]),
    );
    return {
      number: pr.number,
      title: pr.title,
      state: pr.state === "closed" ? "closed" : "open",
      body: pr.body ?? "",
      htmlUrl: pr.html_url,
      author: pr.user?.login ?? "ghost",
      authorAvatarUrl: pr.user?.avatar_url ?? "",
      createdAt: pr.created_at,
      comments: comments.map(mapComment),
      parent: null,
      children: [],
      linked: [],
      mentioned,
      pr: {
        merged: pr.merged ?? pr.merged_at != null,
        draft: !!pr.draft,
        baseRef: pr.base.ref,
        headRef: pr.head.ref,
        commits: pr.commits ?? 0,
        changedFiles: pr.changed_files ?? 0,
        additions: pr.additions ?? 0,
        deletions: pr.deletions ?? 0,
      },
    };
  }

  const [issueRes, comments, relations] = await Promise.all([
    octokit.rest.issues.get({ owner, repo, issue_number: number }),
    octokit.paginate(octokit.rest.issues.listComments, { owner, repo, issue_number: number, per_page: 100 }),
    getIssueRelations(owner, repo, number),
  ]);
  const issue = issueRes.data;
  // Exclude self + already-shown relations so mentions don't duplicate the other blocks.
  const exclude = new Set<string>([`${owner}/${repo}#${number}`]);
  if (relations.parent) exclude.add(`${relations.parent.repo}#${relations.parent.number}`);
  for (const c of relations.children) exclude.add(`${c.repo}#${c.number}`);
  for (const l of relations.linked) exclude.add(`${l.repo}#${l.number}`);
  const mentioned = await findMentionedIssues(octokit, [issue.body, ...comments.map((c) => c.body)], exclude);
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state === "closed" ? "closed" : "open",
    body: issue.body ?? "",
    htmlUrl: issue.html_url,
    author: issue.user?.login ?? "ghost",
    authorAvatarUrl: issue.user?.avatar_url ?? "",
    createdAt: issue.created_at,
    comments: comments.map(mapComment),
    parent: relations.parent,
    children: relations.children,
    linked: relations.linked,
    mentioned,
  };
}
