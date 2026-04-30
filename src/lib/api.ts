import { NextResponse } from "next/server";
import { ZodError, type ZodIssue } from "zod";

/**
 * Tiny helper layer around NextResponse so every JSON endpoint speaks the
 * same dialect:
 *
 *   success → { data: ... }
 *   failure → { error: "message", details?: [...] }
 *
 * Keeps route handlers focused on logic instead of repeating envelope code.
 */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function badRequest(error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status: 400 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(error = "Forbidden") {
  return NextResponse.json({ error }, { status: 403 });
}

export function notFound(error = "Not found") {
  return NextResponse.json({ error }, { status: 404 });
}

export function conflict(error: string) {
  return NextResponse.json({ error }, { status: 409 });
}

export function fromZodError(err: ZodError) {
  const issues = err.issues.map((i: ZodIssue) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return badRequest(issues[0]?.message ?? "Invalid input", issues);
}

/** Safely parse a JSON body, returning a typed badRequest on parse error. */
export async function parseJson(req: Request): Promise<
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, response: badRequest("Invalid JSON body") };
  }
}
