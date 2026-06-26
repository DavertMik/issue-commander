import type { NextRequest } from "next/server";
import { copyIssue } from "@/lib/sources/mutations";
import { copyBodySchema } from "@/lib/validation/schemas";
import { ApiError } from "@/lib/github/errors";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = copyBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(await copyIssue(parsed.data));
  } catch (e) {
    return fail(e);
  }
}
