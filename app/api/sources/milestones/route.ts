import { listMilestones } from "@/lib/sources/listSources";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ milestones: await listMilestones() });
  } catch (e) {
    return fail(e);
  }
}
