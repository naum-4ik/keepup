// lib/request-body.ts
// The check-in routes' bodies (app/api/check-ins/sync, app/api/check-ins/tap): one small JSON object.

// One entry is a few hundred bytes; anything near this is not from the app.
export const MAX_BODY_BYTES = 16 * 1024;

// The body as text, or null when it is over MAX_BODY_BYTES (by its Content-Length, or by what arrives:
// a chunked body has no length).
export async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await request.text().catch(() => "");
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text;
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
