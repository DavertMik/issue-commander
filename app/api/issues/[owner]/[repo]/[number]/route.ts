import type { NextRequest } from "next/server";
import { getIssueDetail } from "@/lib/sources/getIssueDetail";
import { addComment, updateIssue } from "@/lib/sources/mutations";
import { addCommentBodySchema, patchIssueBodySchema } from "@/lib/validation/schemas";
import { ApiError } from "@/lib/github/errors";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ owner: string; repo: string; number: string }> };

function parseNumber(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ApiError("BAD_REQUEST", 400, `Invalid issue number: ${raw}`);
  }
  return n;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { owner, repo, number } = await ctx.params;
    const isPr = request.nextUrl.searchParams.get("kind") === "pr";
    return ok(await getIssueDetail(owner, repo, parseNumber(number), isPr));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { owner, repo, number } = await ctx.params;
    const json = await request.json().catch(() => null);
    const parsed = patchIssueBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(await updateIssue(owner, repo, parseNumber(number), parsed.data));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { owner, repo, number } = await ctx.params;
    const json = await request.json().catch(() => null);
    const parsed = addCommentBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(await addComment(owner, repo, parseNumber(number), parsed.data.body));
  } catch (e) {
    return fail(e);
  }
}
