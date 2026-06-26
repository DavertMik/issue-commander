import { getOctokit } from "@/lib/github/client";
import { getIssueRelations } from "@/lib/github/graphql";
import type { IssueDetail } from "@/lib/types";

export async function getIssueDetail(owner: string, repo: string, number: number): Promise<IssueDetail> {
  const octokit = getOctokit();
  const [issueRes, comments, relations] = await Promise.all([
    octokit.rest.issues.get({ owner, repo, issue_number: number }),
    octokit.paginate(octokit.rest.issues.listComments, { owner, repo, issue_number: number, per_page: 100 }),
    getIssueRelations(owner, repo, number),
  ]);
  const issue = issueRes.data;
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state === "closed" ? "closed" : "open",
    body: issue.body ?? "",
    htmlUrl: issue.html_url,
    author: issue.user?.login ?? "ghost",
    authorAvatarUrl: issue.user?.avatar_url ?? "",
    createdAt: issue.created_at,
    comments: comments.map((c) => ({
      author: c.user?.login ?? "ghost",
      authorAvatarUrl: c.user?.avatar_url ?? "",
      body: c.body ?? "",
      createdAt: c.created_at,
    })),
    parent: relations.parent,
    children: relations.children,
    linked: relations.linked,
  };
}
