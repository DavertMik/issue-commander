import { GithubConfigError } from "./errors";

/**
 * The single organization the whole app is scoped to. Fixed via GITHUB_ORG.
 * Changing org = edit .env.local + restart (no in-app switching by design).
 */
export function getOrg(): string {
  const org = process.env.GITHUB_ORG?.trim();
  if (!org) {
    throw new GithubConfigError(
      "NO_ORG",
      "GITHUB_ORG is not set. Add `GITHUB_ORG=your-org` to .env.local and restart.",
    );
  }
  return org;
}
