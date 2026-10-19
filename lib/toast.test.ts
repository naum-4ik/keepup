import { describe, expect, it } from "vitest";
import {
  MAX_WAITING,
  TOAST_COOKIE,
  dismissToast,
  emptyToasts,
  flashFromCookieString,
  isSafeHref,
  parseFlash,
  pushToast,
  serializeFlash,
  toastDuration,
  type Toast,
} from "./toast";

const toast = (id: string, extra: Partial<Toast> = {}): Toast => ({ id, text: `Toast ${id}`, ...extra });

describe("toast queue", () => {
  it("shows the first toast at once and queues the next", () => {
    const one = pushToast(emptyToasts, toast("a"));
    expect(one.current?.id).toBe("a");
    const two = pushToast(one, toast("b"));
    expect(two.current?.id).toBe("a");
    expect(two.waiting.map((t) => t.id)).toEqual(["b"]);
  });

  it("shows the same id once (flash read from the server render and from the cookie)", () => {
    const s = pushToast(pushToast(emptyToasts, toast("a")), toast("b"));
    expect(pushToast(s, toast("a"))).toBe(s);
    expect(pushToast(s, toast("b"))).toBe(s);
  });

  it(`keeps at most ${MAX_WAITING} waiting, dropping the oldest`, () => {
    let s = pushToast(emptyToasts, toast("a"));
    for (const id of ["b", "c", "d"]) s = pushToast(s, toast(id));
    expect(s.current?.id).toBe("a");
    expect(s.waiting.map((t) => t.id)).toEqual(["c", "d"]);
  });

  it("dismissing the current one shows the next, then nothing", () => {
    let s = pushToast(pushToast(emptyToasts, toast("a")), toast("b"));
    s = dismissToast(s, "a");
    expect(s.current?.id).toBe("b");
    expect(s.waiting).toEqual([]);
    s = dismissToast(s, "b");
    expect(s).toEqual(emptyToasts);
  });

  it("a late dismiss of a toast that is not showing changes nothing", () => {
    const s = pushToast(pushToast(emptyToasts, toast("a")), toast("b"));
    expect(dismissToast(s, "b")).toBe(s);
    expect(dismissToast(emptyToasts, "a")).toBe(emptyToasts);
  });

  it("stays longer when it has an action", () => {
    expect(toastDuration(toast("a"))).toBe(5000);
    expect(toastDuration(toast("a", { action: { label: "Undo", onAction: () => {} } }))).toBe(8000);
  });
});

describe("isSafeHref", () => {
  it.each(["/today", "/habits/1?view=archived", "/progress#x"])("accepts the in-app path %s", (href) => {
    expect(isSafeHref(href)).toBe(true);
  });
  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "today", "", "/to day", "/a\nb"])(
    "rejects %j",
    (href) => expect(isSafeHref(href)).toBe(false),
  );
});

describe("flash cookie", () => {
  const flash = { id: "f1", text: "habits.toast.added", values: { habit: "Read", n: 2 }, action: { label: "common.open", href: "/habits/1" } };

  it("round-trips as the server reads it (JSON) and as document.cookie reads it (URI-encoded)", () => {
    const value = serializeFlash(flash);
    expect(parseFlash(value)).toEqual(flash);
    expect(parseFlash(encodeURIComponent(value))).toEqual(flash);
  });

  it("keeps a flash without values or action", () => {
    expect(parseFlash(serializeFlash({ id: "f2", text: "common.saved" }))).toEqual({ id: "f2", text: "common.saved" });
  });

  it("drops unknown fields", () => {
    expect(parseFlash(JSON.stringify({ id: "f3", text: "common.saved", html: "<b>x</b>" }))).toEqual({ id: "f3", text: "common.saved" });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not JSON", "%7Bnope"],
    ["bad URI encoding", "%E0%A4%A"],
    ["an array", "[1]"],
    ["no id", JSON.stringify({ text: "common.saved" })],
    ["plain text instead of a key", JSON.stringify({ id: "x", text: "You won a prize" })],
    ["a one-word key", JSON.stringify({ id: "x", text: "saved" })],
    ["object values", JSON.stringify({ id: "x", text: "common.saved", values: { a: { b: 1 } } })],
    ["off-site action", JSON.stringify({ id: "x", text: "common.saved", action: { label: "common.open", href: "//evil.example" } })],
    ["action label not a key", JSON.stringify({ id: "x", text: "common.saved", action: { label: "Click me", href: "/today" } })],
    ["too long", JSON.stringify({ id: "x", text: "common.saved", values: { a: "x".repeat(2000) } })],
  ])("rejects %s", (_, raw) => {
    expect(parseFlash(raw)).toBeNull();
  });

  it("finds the flash cookie in a document.cookie string", () => {
    const value = encodeURIComponent(serializeFlash({ id: "f4", text: "common.saved" }));
    expect(flashFromCookieString(`locale=en; ${TOAST_COOKIE}=${value}; other=1`)).toBe(value);
    expect(flashFromCookieString("locale=en")).toBeNull();
    expect(flashFromCookieString("")).toBeNull();
    expect(flashFromCookieString(`${TOAST_COOKIE}-other=x`)).toBeNull();
  });
});
