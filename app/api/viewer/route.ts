import { getOctokit } from "@/lib/github/client";
import { fail, ok } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The token holder never changes within a server process — cache the login.
let cachedLogin: string | null = null;

/** GET /api/viewer — the authenticated user's login (for "@me" filters). */
export async function GET() {
  try {
    if (!cachedLogin) {
      const { data } = await getOctokit().rest.users.getAuthenticated();
      cachedLogin = data.login;
    }
    return ok({ login: cachedLogin });
  } catch (e) {
    return fail(e);
  }
}
