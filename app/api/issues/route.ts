import type { NextRequest } from "next/server";
import { listIssues } from "@/lib/sources/listIssues";
import { createIssue } from "@/lib/sources/mutations";
import { createIssueBodySchema, listIssuesQuerySchema } from "@/lib/validation/schemas";
import { ApiError } from "@/lib/github/errors";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listIssuesQuerySchema.safeParse(params);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(await listIssues(parsed.data));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = createIssueBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(await createIssue(parsed.data));
  } catch (e) {
    return fail(e);
  }
}
