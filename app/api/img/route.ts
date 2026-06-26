import type { NextRequest } from "next/server";
import { getToken } from "@/lib/github/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only proxy GitHub-hosted image URLs (avoids an open proxy / SSRF).
function allowedHost(host: string): boolean {
  return host === "github.com" || host.endsWith(".githubusercontent.com");
}

/**
 * Proxy GitHub attachment images through our origin. GitHub's user-attachments
 * are auth/hotlink-protected, so an <img> from the browser is blocked; the server
 * fetches them with the gh token (following the redirect to the signed S3 URL,
 * which drops the auth header cross-origin) and streams the bytes back.
 */
export async function GET(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u");
  if (!u) return new Response("Missing url", { status: 400 });

  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (url.protocol !== "https:" || !allowedHost(url.hostname)) {
    return new Response("Forbidden host", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken()}`, "User-Agent": "total-issues/0.1" },
      redirect: "follow",
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream error", { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, max-age=300",
    },
  });
}
