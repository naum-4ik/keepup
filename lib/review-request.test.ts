// lib/review-request.test.ts
import { describe, expect, it } from "vitest";
import { parseReviewRequest } from "./review-request";

const id = "00000000-0000-0000-0000-0000000000c1";

describe("parseReviewRequest", () => {
  it("accepts a same-origin approve or reject", () => {
    expect(parseReviewRequest({ id, origin: "https://keepup-murex.vercel.app", host: "keepup-murex.vercel.app", body: { approve: true } }))
      .toEqual({ ok: true, checkInId: id, approve: true });
    expect(parseReviewRequest({ id, origin: null, host: "keepup-murex.vercel.app", body: { approve: false } }))
      .toEqual({ ok: true, checkInId: id, approve: false });
  });

  it("refuses another site", () => {
    expect(parseReviewRequest({ id, origin: "https://evil.example", host: "keepup-murex.vercel.app", body: { approve: true } }))
      .toEqual({ ok: false, status: 403 });
    expect(parseReviewRequest({ id, origin: "null", host: "keepup-murex.vercel.app", body: { approve: true } }))
      .toEqual({ ok: false, status: 403 });
  });

  it("refuses a bad id or body", () => {
    expect(parseReviewRequest({ id: "x", origin: null, host: "h", body: { approve: true } })).toEqual({ ok: false, status: 400 });
    expect(parseReviewRequest({ id, origin: null, host: "h", body: { approve: "yes" } })).toEqual({ ok: false, status: 400 });
    expect(parseReviewRequest({ id, origin: null, host: "h", body: null })).toEqual({ ok: false, status: 400 });
  });
});
