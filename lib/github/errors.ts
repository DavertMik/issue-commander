// Centralized error model. Route handlers throw ApiError (or any error) and use
// respond.fail() to map it to a JSON envelope with a stable code + HTTP status.

export type ApiErrorCode =
  | "NO_TOKEN"
  | "NO_ORG"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "REPO_NOT_FOUND"
  | "PROJECT_NOT_FOUND"
  | "RATE_LIMITED"
  | "MILESTONE_NOT_FOUND"
  | "COPY_TARGET_NOT_PROJECT"
  | "GITHUB_ERROR"
  | "INTERNAL";

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  extra?: Record<string, unknown>;

  constructor(code: ApiErrorCode, status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

/** Config problems (missing token/org) — surfaced as 500 with a clear message. */
export class GithubConfigError extends ApiError {
  constructor(code: "NO_TOKEN" | "NO_ORG", message: string) {
    super(code, 500, message);
    this.name = "GithubConfigError";
  }
}

interface MaybeRequestError {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, string> };
  errors?: Array<{ type?: string; message?: string }>;
}

/** Normalize anything thrown (Octokit RequestError, GraphqlResponseError, plain Error). */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;

  const err = (e ?? {}) as MaybeRequestError;

  // GraphQL errors (octokit GraphqlResponseError) carry an `errors` array.
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    const rateLimited = err.errors.some((x) => x.type === "RATE_LIMITED");
    if (rateLimited) {
      return new ApiError("RATE_LIMITED", 429, "GitHub GraphQL rate limit exceeded. Try again shortly.");
    }
    const notFound = err.errors.some((x) => x.type === "NOT_FOUND");
    if (notFound) {
      return new ApiError("NOT_FOUND", 404, err.errors[0]?.message ?? "Resource not found.");
    }
    return new ApiError("GITHUB_ERROR", 502, err.errors.map((x) => x.message).filter(Boolean).join("; ") || "GitHub GraphQL error.");
  }

  const status = typeof err.status === "number" ? err.status : undefined;

  if (status === 403 || status === 429) {
    const remaining = err.response?.headers?.["x-ratelimit-remaining"];
    const reset = err.response?.headers?.["x-ratelimit-reset"];
    if (status === 429 || remaining === "0") {
      const retryAfterSeconds = reset ? Math.max(0, Number(reset) - Math.floor(Date.now() / 1000)) : undefined;
      return new ApiError("RATE_LIMITED", 429, "GitHub REST rate limit exceeded.", { retryAfterSeconds });
    }
  }

  if (status === 404) {
    // GitHub returns 404 (not 403) for unauthorized access to private resources.
    return new ApiError("NOT_FOUND", 404, err.message ?? "Not found or no access.");
  }

  if (status && status >= 400 && status < 500) {
    return new ApiError("BAD_REQUEST", status, err.message ?? "Bad request.");
  }

  return new ApiError("GITHUB_ERROR", 502, err.message ?? "Unexpected GitHub error.");
}
