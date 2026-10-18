// supabase/functions/send-push/handler.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import type { PushJob } from "./build.ts";
import { type Delivery, type Deps, handle } from "./handler.ts";

const job: PushJob = {
  id: "n1", kind: "nudge", user_id: "u1", pushed: false, group_id: "g1", group: "Family", habit_id: "h1", habit: "Run",
  period: "day", target: 1, check_in_id: null, check_in_status: null, actor: "Anna", subject_id: null, subject: null,
  payload: { kind: "you_got_this" }, names: [], pending: [],
  subscriptions: [
    { endpoint: "https://push.example/ok", p256dh: "p", auth: "a" },
    { endpoint: "https://push.example/gone", p256dh: "p", auth: "a" },
    { endpoint: "https://push.example/missing", p256dh: "p", auth: "a" },
    { endpoint: "https://push.example/flaky", p256dh: "p", auth: "a" },
  ],
};

function deps(over: Partial<Deps> = {}) {
  const sent: string[] = [];
  const done: [string, string[]][] = [];
  const logged: Delivery[] = [];
  const d: Deps = {
    secret: "s3cret",
    pushConfigured: true,
    loadJob: async () => job,
    send: async (sub) => {
      const code = { "https://push.example/gone": 410, "https://push.example/missing": 404, "https://push.example/flaky": 500 }[sub.endpoint];
      if (code) throw Object.assign(new Error("push failed"), { statusCode: code });
      sent.push(sub.endpoint);
    },
    done: async (id, dead) => void done.push([id, dead]),
    log: async (row) => void logged.push(row),
    ...over,
  };
  return { d, sent, done, logged };
}

const post = (body: unknown, secret = "s3cret") =>
  new Request("http://localhost/send-push", { method: "POST", headers: { "x-keepup-push-secret": secret }, body: JSON.stringify(body) });

Deno.test("refuses a call without the shared secret", async () => {
  const { d, sent } = deps();
  assertEquals((await handle(post({ id: "n1" }, "wrong"), d)).status, 403);
  assertEquals(sent, []);
});

Deno.test("refuses a wrong secret of the same length", async () => {
  const { d, sent } = deps();
  assertEquals((await handle(post({ id: "n1" }, "s3creX"), d)).status, 403);
  assertEquals(sent, []);
});

Deno.test("without VAPID keys: 500, nothing sent, the row is not marked done", async () => {
  const { d, sent, done } = deps({ pushConfigured: false });
  assertEquals((await handle(post({ id: "n1" }), d)).status, 500);
  assertEquals([sent, done], [[], []]);
});

Deno.test("refuses everything when no secret is configured", async () => {
  const { d } = deps({ secret: "" });
  assertEquals((await handle(post({ id: "n1" }, ""), d)).status, 403);
});

Deno.test("a body without an id is a bad request", async () => {
  const { d } = deps();
  assertEquals((await handle(post({}), d)).status, 400);
});

Deno.test("404 and 410 endpoints are reported dead, others are kept", async () => {
  const { d, sent, done } = deps();
  const res = await handle(post({ id: "n1" }), d);
  assertEquals(res.status, 200);
  assertEquals(sent, ["https://push.example/ok"]);
  assertEquals(done.length, 1);
  assertEquals(done[0][0], "n1");
  assertEquals(done[0][1].sort(), ["https://push.example/gone", "https://push.example/missing"]);
});

Deno.test("a webhook resent for a row already pushed sends nothing", async () => {
  const { d, sent, done } = deps({ loadJob: async () => ({ ...job, pushed: true }) });
  assertEquals(await (await handle(post({ id: "n1" }), d)).json(), { skipped: true });
  assertEquals([sent, done], [[], []]);
});

Deno.test("nothing to show: marked done without sending", async () => {
  const { d, sent, done } = deps({ loadJob: async () => ({ ...job, kind: "approval_needed", pending: [] }) });
  await handle(post({ id: "n1" }), d);
  assertEquals(sent, []);
  assertEquals(done, [["n1", []]]);
});

Deno.test("the push is rendered in the recipient's language (an unknown one reads as English)", async () => {
  const bodies: string[] = [];
  const { d } = deps({
    loadJob: async () => ({ ...job, locale: "fr", subscriptions: [job.subscriptions[0]] }),
    send: async (_sub, payload) => void bodies.push(JSON.parse(payload).body),
  });
  await handle(post({ id: "n1" }), d);
  assertEquals(bodies, ["\u2068Anna\u2069: You've got this: \u2068Run\u2069"]);
});

// The delivery log (public.push_deliveries): one row per device, or one 'skipped' row without a device.
const byHost = (rows: Delivery[]) => rows.map((r) => [r.outcome, r.reason, r.status, r.endpoint_host]).sort();

Deno.test("logs one row per device: sent, gone (404/410) and failed, with the HTTP status", async () => {
  const { d, logged } = deps({
    send: async (sub) => {
      const code = { "https://push.example/gone": 410, "https://push.example/missing": 404, "https://push.example/flaky": 500 }[sub.endpoint];
      if (code) throw Object.assign(new Error("push failed"), { statusCode: code });
      return 201;
    },
  });
  await handle(post({ id: "n1" }), d);
  assertEquals(logged.length, 4);
  for (const row of logged) assertEquals([row.notification_id, row.user_id, row.kind], ["n1", "u1", "nudge"]);
  assertEquals(byHost(logged), [
    ["failed", "http_500", 500, "push.example"],
    ["gone", "http_404", 404, "push.example"],
    ["gone", "http_410", 410, "push.example"],
    ["sent", null, 201, "push.example"],
  ]);
});

Deno.test("a send that fails without an HTTP status is logged as a network failure", async () => {
  const { d, logged } = deps({
    loadJob: async () => ({ ...job, subscriptions: [job.subscriptions[0]] }),
    send: async () => {
      throw new Error("timeout");
    },
  });
  await handle(post({ id: "n1" }), d);
  assertEquals(byHost(logged), [["failed", "network", null, "push.example"]]);
});

Deno.test("no device: one skipped row, nothing sent", async () => {
  const { d, sent, done, logged } = deps({ loadJob: async () => ({ ...job, subscriptions: [] }) });
  assertEquals(await (await handle(post({ id: "n1" }), d)).json(), { sent: 0, dead: 0 });
  assertEquals([sent, done], [[], [["n1", []]]]);
  assertEquals(logged, [{
    notification_id: "n1", user_id: "u1", kind: "nudge", outcome: "skipped", reason: "no_device", status: null, endpoint_host: null,
  }]);
});

Deno.test("the log never stores the endpoint path or the device keys", async () => {
  const { d, logged } = deps();
  await handle(post({ id: "n1" }), d);
  const text = JSON.stringify(logged);
  for (const secret of ["/ok", "/gone", "p256dh", "\"auth\""]) assertEquals(text.includes(secret), false, secret);
});

Deno.test("a failing log insert doesn't break sending", async () => {
  const { d, sent, done } = deps({
    log: async () => {
      throw new Error("push_deliveries: permission denied");
    },
  });
  const res = await handle(post({ id: "n1" }), d);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 1, dead: 2 });
  assertEquals(sent, ["https://push.example/ok"]);
  assertEquals(done.length, 1);
});

Deno.test("nothing is logged for a row already pushed or with nothing to show", async () => {
  const pushed = deps({ loadJob: async () => ({ ...job, pushed: true }) });
  await handle(post({ id: "n1" }), pushed.d);
  const empty = deps({ loadJob: async () => ({ ...job, kind: "approval_needed", pending: [] }) });
  await handle(post({ id: "n1" }), empty.d);
  assertEquals([pushed.logged, empty.logged], [[], []]);
});
