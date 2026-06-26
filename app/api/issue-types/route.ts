import { listIssueTypes } from "@/lib/sources/issueTypes";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ types: await listIssueTypes() });
  } catch (e) {
    return fail(e);
  }
}
