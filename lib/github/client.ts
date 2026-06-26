import { Octokit } from "octokit";
import { getToken } from "./token";

let octokit: Octokit | null = null;

/**
 * Singleton authenticated Octokit. Exposes `.rest`, `.graphql`, `.paginate`
 * on one client sharing a single token. Survives across requests in the Node
 * server runtime (route handlers must run on the Node runtime — see each route).
 */
export function getOctokit(): Octokit {
  if (octokit) return octokit;
  octokit = new Octokit({ auth: getToken(), userAgent: "total-issues/0.1" });
  return octokit;
}
