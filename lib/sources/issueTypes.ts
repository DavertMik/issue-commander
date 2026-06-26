import { getOctokit } from "@/lib/github/client";
import { getOrg } from "@/lib/github/org";

/** Org-level Issue Type names (Bug / Feature / Task …). Empty if the org hasn't enabled issue types. */
export async function listIssueTypes(): Promise<string[]> {
  const org = getOrg();
  try {
    const res = await getOctokit().request("GET /orgs/{org}/issue-types", { org });
    const data = res.data as Array<{ name?: string | null }>;
    return data.map((t) => t.name).filter((n): n is string => !!n);
  } catch {
    return []; // issue types not enabled for this org / insufficient scope
  }
}
