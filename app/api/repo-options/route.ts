import type { NextRequest } from "next/server";
import { listRepoOptions } from "@/lib/sources/listSources";
import { repoOptionsQuerySchema } from "@/lib/validation/schemas";
import { ApiError } from "@/lib/github/errors";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = repoOptionsQuerySchema.safeParse(params);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", 400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(await listRepoOptions(parsed.data.repo));
  } catch (e) {
    return fail(e);
  }
}
