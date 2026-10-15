type Messages = { [key: string]: unknown };

const isPlain = (v: unknown): v is Messages => typeof v === "object" && v !== null && !Array.isArray(v);

// Overlay's leaves win; keys the overlay lacks keep the base (English). Arrays and strings are replaced, not merged.
export function deepMerge<T extends Messages>(base: T, overlay: Messages): T {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    out[k] = isPlain(v) && isPlain(out[k]) ? deepMerge(out[k] as Messages, v) : v;
  }
  return out as T;
}
