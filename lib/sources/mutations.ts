import { getOctokit } from "@/lib/github/client";
import { getOrg } from "@/lib/github/org";
import { ApiError } from "@/lib/github/errors";
import { addProjectItem, deleteProjectItem, resolveProjectId, resolveRepoId, transferIssue } from "@/lib/github/graphql";
import { mapRestIssue, type RestIssue } from "@/lib/domain/mappers";
import type { CopyResult, IssueComment, IssueRow, MoveResult } from "@/lib/types";
import type { CopyBody, CreateIssueBody, MoveBody, PatchIssueBody } from "@/lib/validation/schemas";

/** Create a new issue in a repo (+ optionally add it to a project). */
export async function createIssue(body: CreateIssueBody): Promise<IssueRow> {
  const org = getOrg();
  const octokit = getOctokit();

  // Resolve the org-wide milestone title to a number within THIS repo (same as a milestone move).
  let milestoneNumber: number | undefined;
  if (body.milestoneTitle) {
    const milestones = await octokit.paginate(octokit.rest.issues.listMilestones, {
      owner: org,
      repo: body.repo,
      state: "all",
      per_page: 100,
    });
    const found = milestones.find((m) => m.title === body.milestoneTitle);
    if (!found) {
      throw new ApiError(
        "MILESTONE_NOT_FOUND",
        400,
        `Repo "${body.repo}" has no milestone "${body.milestoneTitle}". Create it there first or pick another.`,
      );
    }
    milestoneNumber = found.number;
  }

  // `type` (Issue Type name) isn't in octokit's generated params yet — widen the type to pass it.
  const createParams: Parameters<typeof octokit.rest.issues.create>[0] & { type?: string } = {
    owner: org,
    repo: body.repo,
    title: body.title,
    ...(body.body ? { body: body.body } : {}),
    ...(body.assignees?.length ? { assignees: body.assignees } : {}),
    ...(body.labels?.length ? { labels: body.labels } : {}),
    ...(milestoneNumber != null ? { milestone: milestoneNumber } : {}),
    ...(body.type ? { type: body.type } : {}),
  };
  const res = await octokit.rest.issues.create(createParams);

  if (body.projectNumber) {
    // The issue is already created; a project-add failure shouldn't fail the whole request.
    try {
      const project = await resolveProjectId(org, body.projectNumber);
      await addProjectItem(project.id, res.data.node_id);
    } catch {
      /* membership can be added later via F5 */
    }
  }
  return mapRestIssue(res.data as unknown as RestIssue, { owner: org, name: body.repo });
}

/** F3 preview — post a comment on an issue. */
export async function addComment(
  owner: string,
  repo: string,
  number: number,
  body: string,
): Promise<IssueComment> {
  const res = await getOctokit().rest.issues.createComment({ owner, repo, issue_number: number, body });
  const c = res.data;
  return {
    author: c.user?.login ?? "you",
    authorAvatarUrl: c.user?.avatar_url ?? "",
    body: c.body ?? body,
    createdAt: c.created_at,
  };
}

/** F4 edit / F8 close / same-repo milestone set — composed into one REST update. */
export async function updateIssue(
  owner: string,
  repo: string,
  number: number,
  patch: PatchIssueBody,
): Promise<IssueRow> {
  const params: Parameters<ReturnType<typeof getOctokit>["rest"]["issues"]["update"]>[0] & {
    type?: string | null;
  } = {
    owner,
    repo,
    issue_number: number,
  };
  if (patch.body !== undefined) params.body = patch.body;
  if (patch.state !== undefined) params.state = patch.state;
  if (patch.milestoneNumber !== undefined) params.milestone = patch.milestoneNumber;
  if (patch.assignees !== undefined) params.assignees = patch.assignees;
  if (patch.labels !== undefined) params.labels = patch.labels;
  if (patch.type !== undefined) params.type = patch.type; // Issue Type name; null clears

  const res = await getOctokit().rest.issues.update(params);
  return mapRestIssue(res.data as unknown as RestIssue, { owner, name: repo });
}

/** F6 move. */
export async function moveIssue(body: MoveBody): Promise<MoveResult> {
  const org = getOrg();

  if (body.mode === "repo") {
    const repoId = await resolveRepoId(org, body.targetRepo);
    const res = await transferIssue(body.issueNodeId, repoId);
    return {
      mode: "repo",
      renumbered: true,
      newNumber: res.number,
      newUrl: res.url,
      newNodeId: res.id,
      warning: "Issue transferred — it has a new number; the old URL now redirects.",
    };
  }

  if (body.mode === "milestone") {
    const octokit = getOctokit();
    let milestoneNumber: number | null = null;

    // Resolve the org-wide title to a milestone number within the issue's OWN repo.
    if (body.targetTitle !== null) {
      const milestones = await octokit.paginate(octokit.rest.issues.listMilestones, {
        owner: org,
        repo: body.repo,
        state: "all",
        per_page: 100,
      });
      const found = milestones.find((m) => m.title === body.targetTitle);
      if (!found) {
        throw new ApiError(
          "MILESTONE_NOT_FOUND",
          400,
          `Repo "${body.repo}" has no milestone "${body.targetTitle}". Create it there first, or transfer the issue to a repo that has it.`,
        );
      }
      milestoneNumber = found.number;
    }

    await octokit.rest.issues.update({
      owner: org,
      repo: body.repo,
      issue_number: body.number,
      milestone: milestoneNumber,
    });
    return { mode: "milestone" };
  }

  // mode === "project": add to target first, then remove from source (never lose membership).
  const newProjectItemId = await addProjectItem(body.targetProjectId, body.issueNodeId);
  await deleteProjectItem(body.sourceProjectId, body.sourceProjectItemId);
  return { mode: "project", newProjectItemId };
}

/** F5 copy — Projects V2 only. addProjectV2ItemById is idempotent if already present. */
export async function copyIssue(body: CopyBody): Promise<CopyResult> {
  const projectItemId = await addProjectItem(body.targetProjectId, body.issueNodeId);
  return { projectItemId };
}
