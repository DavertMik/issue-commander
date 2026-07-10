import type { NextRequest } from "next/server";
import { setReviewers } from "@/lib/sources/mutations";
import { setReviewersBodySchema } from "@/lib/validation/schemas";
import { ApiError } from "@/lib/github/errors";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = setReviewersBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const { owner, repo, number, add, remove } = parsed.data;
    await setReviewers(owner, repo, number, add, remove);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
