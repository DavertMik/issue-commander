import { z } from "zod";

export const issueListStateSchema = z.enum(["open", "closed", "all"]);

/** GET /api/issues — query params (parsed from the URL search params object). */
// `preferredProject` (a project number) tells enrichment which project's Status to attach to each
// issue (defaults to the issue's first project). It comes from the user's default-project setting.
export const listIssuesQuerySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("repo"),
    repo: z.string().min(1),
    state: issueListStateSchema.optional(),
    cursor: z.string().optional(),
    preferredProject: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("milestone"),
    title: z.string().min(1),
    state: issueListStateSchema.optional(),
    cursor: z.string().optional(),
    preferredProject: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("project"),
    projectNumber: z.coerce.number().int().positive(),
    cursor: z.string().optional(),
  }),
  z.object({
    kind: z.literal("recent"),
    state: issueListStateSchema.optional(),
    cursor: z.string().optional(),
    preferredProject: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("pulls"),
    repo: z.string().min(1),
    state: issueListStateSchema.optional(),
    cursor: z.string().optional(),
  }),
]);
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;

// GET /api/sources/milestones takes no params — it aggregates titles org-wide.

/** PATCH /api/issues/[owner]/[repo]/[number] */
export const patchIssueBodySchema = z
  .object({
    body: z.string().optional(),
    state: z.enum(["open", "closed"]).optional(),
    milestoneNumber: z.number().int().nullable().optional(),
    assignees: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
    type: z.string().nullable().optional(), // org issue type name; null clears it
  })
  .refine(
    (v) =>
      v.body !== undefined ||
      v.state !== undefined ||
      v.milestoneNumber !== undefined ||
      v.assignees !== undefined ||
      v.labels !== undefined ||
      v.type !== undefined,
    { message: "Provide at least one field to update." },
  );
export type PatchIssueBody = z.infer<typeof patchIssueBodySchema>;

/** POST /api/issues — create a new issue (+ optionally add it to a project). */
export const createIssueBodySchema = z.object({
  repo: z.string().min(1),
  title: z.string().trim().min(1),
  body: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  // Org-wide milestone title / project number — resolved to repo-milestone-number / project-id server-side,
  // so the client doesn't need to load those lists before pre-filling from a pane source or defaults.
  labels: z.array(z.string()).optional(),
  milestoneTitle: z.string().min(1).nullable().optional(),
  projectNumber: z.number().int().positive().optional(),
  type: z.string().min(1).optional(), // org issue type name
});
export type CreateIssueBody = z.infer<typeof createIssueBodySchema>;

/** GET /api/repo-options?repo= */
export const repoOptionsQuerySchema = z.object({
  repo: z.string().min(1),
});

/** POST /api/issues/[owner]/[repo]/[number] — add a comment. */
export const addCommentBodySchema = z.object({
  body: z.string().trim().min(1),
});

/** POST /api/actions/move */
export const moveBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("repo"),
    issueNodeId: z.string().min(1),
    targetRepo: z.string().min(1),
  }),
  z.object({
    mode: z.literal("milestone"),
    repo: z.string().min(1),
    number: z.number().int().positive(),
    // Org-wide milestone target by title; null clears the milestone.
    targetTitle: z.string().min(1).nullable(),
  }),
  z.object({
    mode: z.literal("project"),
    issueNodeId: z.string().min(1),
    sourceProjectId: z.string().min(1),
    sourceProjectItemId: z.string().min(1),
    targetProjectId: z.string().min(1),
  }),
]);
export type MoveBody = z.infer<typeof moveBodySchema>;

/** POST /api/actions/copy */
export const copyBodySchema = z.object({
  issueNodeId: z.string().min(1),
  targetProjectId: z.string().min(1),
});
export type CopyBody = z.infer<typeof copyBodySchema>;

/** GET /api/project-status?projectId= */
export const statusFieldQuerySchema = z.object({
  projectId: z.string().min(1),
});

/** POST /api/actions/set-status */
export const setStatusBodySchema = z.object({
  projectId: z.string().min(1),
  itemId: z.string().min(1),
  fieldId: z.string().min(1),
  optionId: z.string().min(1),
});
export type SetStatusBody = z.infer<typeof setStatusBodySchema>;

/** POST /api/actions/set-reviewers — reconcile a pull request's requested reviewers. */
export const setReviewersBodySchema = z
  .object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    number: z.number().int().positive(),
    add: z.array(z.string()).default([]), // logins to request review from
    remove: z.array(z.string()).default([]), // logins whose review request to withdraw
  })
  .refine((b) => b.add.length > 0 || b.remove.length > 0, {
    message: "At least one of add/remove must be non-empty",
  });
export type SetReviewersBody = z.infer<typeof setReviewersBodySchema>;
