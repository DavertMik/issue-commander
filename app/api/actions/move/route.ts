import type { NextRequest } from "next/server";
import { moveIssue } from "@/lib/sources/mutations";
import { moveBodySchema } from "@/lib/validation/schemas";
import { ApiError } from "@/lib/github/errors";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = moveBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(await moveIssue(parsed.data));
  } catch (e) {
    return fail(e);
  }
}
