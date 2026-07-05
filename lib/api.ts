import type {
  CopyResult,
  IssueComment,
  IssueDetail,
  IssueRow,
  MilestoneOption,
  MoveResult,
  PaneListResult,
  ProjectOption,
  RepoOption,
  RepoOptions,
  StatusFieldData,
} from "@/lib/types";
import type { CopyBody, CreateIssueBody, MoveBody, PatchIssueBody, SetStatusBody } from "@/lib/validation/schemas";

export class ApiRequestError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiRequestError(message, res.status, data?.error?.code);
  }
  return data as T;
}

// Retry only on transient failures: 5xx server errors (incl. 502 from upstream GitHub) and
// network errors. 4xx (bad request / not found / conflict) are NOT retried — they won't recover.
function isRetriable(e: unknown): boolean {
  if (e instanceof ApiRequestError) return e.status >= 500;
  return true; // fetch threw before a response (network error)
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts - 1 || !isRetriable(e)) throw e;
      await new Promise((r) => setTimeout(r, 300 * 2 ** i)); // 300ms, 600ms backoff
    }
  }
}

export const api = {
  listIssues: (query: Record<string, string>) =>
    req<PaneListResult>(`/api/issues?${new URLSearchParams(query).toString()}`),

  issueDetail: (owner: string, repo: string, number: number, isPr = false) =>
    req<IssueDetail>(`/api/issues/${owner}/${repo}/${number}${isPr ? "?kind=pr" : ""}`),

  addComment: (owner: string, repo: string, number: number, body: string) =>
    withRetry(() =>
      req<IssueComment>(`/api/issues/${owner}/${repo}/${number}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      }),
    ),

  // No withRetry: issue creation is not idempotent — a retry could create duplicates.
  createIssue: (body: CreateIssueBody) =>
    req<IssueRow>("/api/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),

  repos: () => req<{ repos: RepoOption[] }>("/api/sources/repos").then((r) => r.repos),

  milestones: () => req<{ milestones: MilestoneOption[] }>("/api/sources/milestones").then((r) => r.milestones),

  projects: () => req<{ projects: ProjectOption[] }>("/api/sources/projects").then((r) => r.projects),

  issueTypes: () => req<{ types: string[] }>("/api/issue-types").then((r) => r.types),

  patchIssue: (owner: string, repo: string, number: number, body: PatchIssueBody) =>
    withRetry(() =>
      req<IssueRow>(`/api/issues/${owner}/${repo}/${number}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    ),

  move: (body: MoveBody) =>
    withRetry(() =>
      req<MoveResult>("/api/actions/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    ),

  copy: (body: CopyBody) =>
    withRetry(() =>
      req<CopyResult>("/api/actions/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    ),

  statusField: (projectId: string) =>
    req<StatusFieldData>(`/api/project-status?projectId=${encodeURIComponent(projectId)}`),

  repoOptions: (repo: string) => req<RepoOptions>(`/api/repo-options?repo=${encodeURIComponent(repo)}`),

  setStatus: (body: SetStatusBody) =>
    withRetry(() =>
      req<{ ok: boolean }>("/api/actions/set-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    ),
};
