import { GithubConfigError } from "./errors";

/**
 * The single organization the whole app is scoped to. Set it with the `--org` flag,
 * `IC_GITHUB_ORG` (preferred, prefixed to avoid clashes), or plain `GITHUB_ORG`.
 * There is no in-app switching by design — change it and restart.
 */
export function resolveOrg(): string | null {
  return process.env.IC_GITHUB_ORG?.trim() || process.env.GITHUB_ORG?.trim() || null;
}

export function getOrg(): string {
  const org = resolveOrg();
  if (!org) {
    throw new GithubConfigError(
      "NO_ORG",
      "No GitHub organization set. Pass `--org=<org>`, or set `IC_GITHUB_ORG` / `GITHUB_ORG`.",
    );
  }
  return org;
}
