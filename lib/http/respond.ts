import { NextResponse } from "next/server";
import { toApiError } from "@/lib/github/errors";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** Map any thrown value to the standard error envelope + status. */
export function fail(e: unknown): NextResponse {
  const err = toApiError(e);
  return NextResponse.json(
    { error: { code: err.code, message: err.message, ...(err.extra ?? {}) } },
    { status: err.status },
  );
}
