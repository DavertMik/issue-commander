import { listProjects } from "@/lib/sources/listSources";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ projects: await listProjects() });
  } catch (e) {
    return fail(e);
  }
}
