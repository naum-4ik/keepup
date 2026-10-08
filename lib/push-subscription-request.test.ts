// lib/push-subscription-request.test.ts
import { describe, expect, it, vi } from "vitest";
import { applyPushSubscriptionUpdate, parsePushSubscriptionRequest } from "./push-subscription-request";

const host = "keepup-murex.vercel.app";
const FCM = "https://fcm.googleapis.com/fcm/send/";
const body = { endpoint: `${FCM}new`, p256dh: "p", auth: "a" };
const sub = body;

describe("parsePushSubscriptionRequest", () => {
  it("accepts a same-origin subscription, with the endpoint it replaces or as a refresh", () => {
    expect(parsePushSubscriptionRequest({ origin: `https://${host}`, host, body: { ...body, oldEndpoint: `${FCM}old` } }))
      .toEqual({ ok: true, sub, oldEndpoint: `${FCM}old`, refresh: false });
    expect(parsePushSubscriptionRequest({ origin: null, host, body: { ...body, refresh: true } }))
      .toEqual({ ok: true, sub, oldEndpoint: null, refresh: true });
  });

  it("refuses another site", () => {
    expect(parsePushSubscriptionRequest({ origin: "https://evil.example", host, body })).toEqual({ ok: false, status: 403 });
    expect(parsePushSubscriptionRequest({ origin: "null", host, body })).toEqual({ ok: false, status: 403 });
  });

  it("refuses a body without the endpoint and keys", () => {
    expect(parsePushSubscriptionRequest({ origin: null, host, body: null })).toEqual({ ok: false, status: 400 });
    expect(parsePushSubscriptionRequest({ origin: null, host, body: { ...body, auth: "" } })).toEqual({ ok: false, status: 400 });
    expect(parsePushSubscriptionRequest({ origin: null, host, body: { ...body, p256dh: 1 } })).toEqual({ ok: false, status: 400 });
    expect(parsePushSubscriptionRequest({ origin: null, host, body: { ...body, oldEndpoint: 5 } })).toEqual({ ok: false, status: 400 });
  });
});

function deps(saved = true) {
  return {
    refresh: vi.fn(async () => ({ ok: true as const, saved })),
    rotate: vi.fn(async () => ({ ok: true as const, saved })),
  };
}

describe("applyPushSubscriptionUpdate", () => {
  it("a rotation is one call with the old endpoint: saved means 200", async () => {
    const d = deps(true);
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: `${FCM}old`, refresh: false }, d)).toEqual({ status: 200 });
    expect(d.rotate).toHaveBeenCalledWith(`${FCM}old`, sub);
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it("a rotation of a removed device (the database saved nothing) is 204; without an old endpoint nothing is called", async () => {
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: `${FCM}old`, refresh: false }, deps(false))).toEqual({ status: 204 });
    const d = deps(true);
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: null, refresh: false }, d)).toEqual({ status: 204 });
    expect(d.rotate).not.toHaveBeenCalled();
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it("the re-save on open is one refresh call; a removed device stays removed (204)", async () => {
    const kept = deps(true);
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: null, refresh: true }, kept)).toEqual({ status: 200 });
    expect(kept.refresh).toHaveBeenCalledWith(sub);
    expect(kept.rotate).not.toHaveBeenCalled();
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: null, refresh: true }, deps(false))).toEqual({ status: 204 });
  });

  it("a refused save says why", async () => {
    const d = { ...deps(), rotate: vi.fn(async () => ({ ok: false as const, code: "invalid_subscription" })) };
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: `${FCM}old`, refresh: false }, d)).toEqual({ status: 409, code: "invalid_subscription" });
  });
});
