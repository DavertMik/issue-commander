import type { NextRequest } from "next/server";
import { setItemStatus } from "@/lib/github/graphql";
import { setStatusBodySchema } from "@/lib/validation/schemas";
import { ApiError } from "@/lib/github/errors";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = setStatusBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const { projectId, itemId, fieldId, optionId } = parsed.data;
    await setItemStatus(projectId, itemId, fieldId, optionId);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
