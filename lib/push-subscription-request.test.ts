// lib/push-subscription-request.test.ts
import { describe, expect, it } from "vitest";
import { parsePushSubscriptionRequest } from "./push-subscription-request";

const host = "keepup-murex.vercel.app";
const body = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "p", auth: "a" };

describe("parsePushSubscriptionRequest", () => {
  it("accepts a same-origin renewed subscription", () => {
    expect(parsePushSubscriptionRequest({ origin: `https://${host}`, host, body })).toEqual({ ok: true, sub: body });
    expect(parsePushSubscriptionRequest({ origin: null, host, body })).toEqual({ ok: true, sub: body });
  });

  it("refuses another site", () => {
    expect(parsePushSubscriptionRequest({ origin: "https://evil.example", host, body })).toEqual({ ok: false, status: 403 });
    expect(parsePushSubscriptionRequest({ origin: "null", host, body })).toEqual({ ok: false, status: 403 });
  });

  it("refuses a body without the endpoint and keys", () => {
    expect(parsePushSubscriptionRequest({ origin: null, host, body: null })).toEqual({ ok: false, status: 400 });
    expect(parsePushSubscriptionRequest({ origin: null, host, body: { ...body, auth: "" } })).toEqual({ ok: false, status: 400 });
    expect(parsePushSubscriptionRequest({ origin: null, host, body: { ...body, p256dh: 1 } })).toEqual({ ok: false, status: 400 });
  });
});
