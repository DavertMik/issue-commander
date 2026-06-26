import { execFileSync } from "node:child_process";
import { GithubConfigError } from "./errors";

let cached: string | null = null;

/**
 * Resolve a GitHub token. Prefers GITHUB_TOKEN / GH_TOKEN env vars, otherwise
 * shells out to `gh auth token` (execFile, never a shell — no injection risk).
 * Cached for the process lifetime.
 */
export function getToken(): string {
  if (cached) return cached;

  const envTok = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (envTok && envTok.trim()) {
    cached = envTok.trim();
    return cached;
  }

  try {
    const out = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
    if (!out) throw new Error("empty token");
    cached = out;
    return cached;
  } catch {
    throw new GithubConfigError(
      "NO_TOKEN",
      "No GitHub token found. Set GITHUB_TOKEN in .env.local or run `gh auth login`.",
    );
  }
}

/** Clear the cached token (e.g. after a 401, to re-read from gh). */
export function resetToken(): void {
  cached = null;
}
