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

function deps(owned: string[]) {
  return {
    owns: vi.fn(async (e: string) => owned.includes(e)),
    save: vi.fn(async () => ({ ok: true as const })),
    forget: vi.fn(async () => undefined),
  };
}

describe("applyPushSubscriptionUpdate", () => {
  it("a rotation of a device this account has: the new one is saved, the old row dropped", async () => {
    const d = deps([`${FCM}old`]);
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: `${FCM}old`, refresh: false }, d)).toEqual({ status: 200 });
    expect(d.save).toHaveBeenCalledWith(sub);
    expect(d.forget).toHaveBeenCalledWith(`${FCM}old`);
  });

  it("a rotation of a removed device, or with no old endpoint, saves nothing", async () => {
    const d = deps([]);
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: `${FCM}old`, refresh: false }, d)).toEqual({ status: 204 });
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: null, refresh: false }, deps([`${FCM}new`]))).toEqual({ status: 204 });
    expect(d.save).not.toHaveBeenCalled();
    expect(d.forget).not.toHaveBeenCalled();
  });

  it("the re-save on open saves only an endpoint already saved for this account", async () => {
    const removed = deps([`${FCM}other`]);
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: null, refresh: true }, removed)).toEqual({ status: 204 });
    expect(removed.save).not.toHaveBeenCalled();

    const kept = deps([`${FCM}new`]);
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: null, refresh: true }, kept)).toEqual({ status: 200 });
    expect(kept.save).toHaveBeenCalledWith(sub);
    expect(kept.forget).not.toHaveBeenCalled();
  });

  it("a refused save keeps the old row and says why", async () => {
    const d = { ...deps([`${FCM}old`]), save: vi.fn(async () => ({ ok: false as const, code: "invalid_subscription" })) };
    expect(await applyPushSubscriptionUpdate({ sub, oldEndpoint: `${FCM}old`, refresh: false }, d)).toEqual({ status: 409, code: "invalid_subscription" });
    expect(d.forget).not.toHaveBeenCalled();
  });
});
