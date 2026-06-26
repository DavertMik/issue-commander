import { listRepos } from "@/lib/sources/listSources";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ repos: await listRepos() });
  } catch (e) {
    return fail(e);
  }
}
