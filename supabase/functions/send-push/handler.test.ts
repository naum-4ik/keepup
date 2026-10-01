// supabase/functions/send-push/handler.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import type { PushJob } from "./build.ts";
import { type Deps, handle } from "./handler.ts";

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
    ...over,
  };
  return { d, sent, done };
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
