import { describe, expect, it } from "vitest";
import type { Attributes } from "@opentelemetry/api";
import { context, ROOT_CONTEXT, trace, type ContextManager } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { logEvent, logRecordProcessors, parseHeaders, REDACTED, RedactingLogExporter, RedactingSpanExporter, spanProcessors, userAttributes } from "./telemetry";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln";

function exportOne(name: string, attributes: Attributes) {
  const memory = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(new RedactingSpanExporter(memory))] });
  const span = provider.getTracer("test").startSpan(name);
  span.setAttributes(attributes);
  span.addEvent("exception", { "exception.message": `bad token ${JWT}` });
  span.end();
  return memory.getFinishedSpans()[0];
}

describe("telemetry: no secret leaves the app", () => {
  it("masks the sign-in code, tokens, cookies and keys, wherever they are", () => {
    const span = exportOne("GET /auth/callback?code=pkce-secret", {
      "http.target": "/auth/callback?code=pkce-secret&next=/today",
      "http.url": "https://x.supabase.co/auth/v1/verify?token=email-token&type=signup",
      "http.request.header.authorization": `Bearer ${JWT}`,
      "http.request.header.cookie": "sb-access-token=cookie-secret",
      apikey: "sb_publishable_abc",
      "error.message": "rejected glc_grafana-secret and sb_secret_supabase",
    });
    const sent = JSON.stringify({ name: span.name, attributes: span.attributes, events: span.events });
    expect(sent).not.toMatch(/pkce-secret|email-token|eyJ|cookie-secret|sb_publishable|glc_|sb_secret_/);
    expect(span.attributes["http.target"]).toBe(`/auth/callback?code=${REDACTED}&next=/today`);
    expect(span.spanContext().traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("keeps who and what (owner, 2026-10-07): user ID, email, habit", () => {
    const user = { "user.id": "6f1c0d3e-0000-4000-8000-000000000001", "user.email": "anna@example.com", "habit.id": "h-1" };
    expect(exportOne("POST /api/check-ins/tap", user).attributes).toMatchObject(user);
  });

  it("tags a demo login (no email) by ID only", () => {
    const sub = "6f1c0d3e-0000-4000-8000-000000000002";
    expect(userAttributes({ sub, email: "" })).toEqual({ "user.id": sub });
    expect(userAttributes({ sub, email: null })).toEqual({ "user.id": sub });
    expect(userAttributes({ sub })).toEqual({ "user.id": sub });
    expect(userAttributes({ sub, email: "anna@example.com" })).toEqual({ "user.id": sub, "user.email": "anna@example.com" });
  });

  it("reads the OTel headers format", () => {
    expect(parseHeaders("Authorization=Basic%20abc,X-Scope=1")).toEqual({ Authorization: "Basic abc", "X-Scope": "1" });
    expect(parseHeaders(undefined)).toEqual({});
  });

  it("sends nothing without an endpoint, and one redacted path with one", () => {
    expect(spanProcessors({})).toEqual([]);
    expect(spanProcessors({ OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp.example/otlp" })).toHaveLength(1);
    expect(logRecordProcessors({})).toEqual([]);
    expect(logRecordProcessors({ OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp.example/otlp" })).toHaveLength(1);
  });
});

describe("telemetry: events (logs)", () => {
  const memory = new InMemoryLogRecordExporter();
  logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter: new RedactingLogExporter(memory) })] }));

  it("one event: its name, its fields (empty ones left out), its level, secrets masked", () => {
    memory.reset();
    logEvent("keepup.check_in", { "user.email": "anna@example.com", "habit.title": "Brush teeth", "child.nickname": undefined, "error.message": `bad ${JWT}` }, "ERROR");
    const [record] = memory.getFinishedLogRecords();
    expect(record.eventName).toBe("keepup.check_in");
    expect(record.severityText).toBe("ERROR");
    expect(record.attributes).toEqual({ "event.name": "keepup.check_in", "user.email": "anna@example.com", "habit.title": "Brush teeth", "error.message": `bad ${REDACTED}` });
  });

  it("carries the trace it happened in, so Grafana links the two", () => {
    // The app's context manager is @vercel/otel's (AsyncLocalStorage); a plain stack does for one sync call.
    let current = ROOT_CONTEXT;
    const stack: ContextManager = {
      active: () => current,
      with: (ctx, fn, thisArg, ...args) => {
        const previous = current;
        current = ctx;
        try {
          return fn.call(thisArg, ...args);
        } finally {
          current = previous;
        }
      },
      bind: (_ctx, target) => target,
      enable: () => stack,
      disable: () => stack,
    };
    context.setGlobalContextManager(stack);
    memory.reset();
    const span = new BasicTracerProvider().getTracer("test").startSpan("POST /api/check-ins/tap");
    context.with(trace.setSpan(context.active(), span), () => logEvent("keepup.check_in", {}));
    expect(memory.getFinishedLogRecords()[0].spanContext?.traceId).toBe(span.spanContext().traceId);
  });
});
