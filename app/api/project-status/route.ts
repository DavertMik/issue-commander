import type { NextRequest } from "next/server";
import { getStatusField } from "@/lib/github/graphql";
import { statusFieldQuerySchema } from "@/lib/validation/schemas";
import { ApiError } from "@/lib/github/errors";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = statusFieldQuerySchema.safeParse(params);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const field = await getStatusField(parsed.data.projectId);
    if (!field) throw new ApiError("NOT_FOUND", 404, "This project has no Status field.");
    return ok(field);
  } catch (e) {
    return fail(e);
  }
}
