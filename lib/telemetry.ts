import { BatchSpanProcessor, type ReadableSpan, type SpanExporter, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { trace, type Attributes, type AttributeValue } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { BatchLogRecordProcessor, type LogRecordExporter, type LogRecordProcessor, type ReadableLogRecord } from "@opentelemetry/sdk-logs";
import { OTLPHttpProtoTraceExporter } from "@vercel/otel";
import { REDACTED, redactString } from "@/lib/redact";

export { REDACTED };

// Keys whose whole value is a secret (the strings themselves are cleaned by lib/redact.ts).
const SECRET_KEY = /authorization|cookie|password|secret|token|api[-_]?key/i;

function redactValue(key: string, value: AttributeValue | undefined) {
  if (SECRET_KEY.test(key)) return REDACTED;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? redactString(v) : v)) as AttributeValue;
  return value;
}

export function redactAttributes(attributes: Attributes): Attributes {
  return Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, redactValue(key, value)]));
}

// One name per kind of call: "fetch GET https://x.supabase.co/rest/v1/check_ins?habit_id=eq.<id>" becomes
// "fetch GET /rest/v1/check_ins". Span metrics make one series per span name, so names with ids grew a
// series per habit and per person (978 in two days). The full URL stays in the span's attributes.
export function spanName(name: string) {
  return name
    .replace(/^(fetch [A-Z]+ )https?:\/\/[^/\s]+([^?#\s]*)\S*$/, "$1$2")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, "/[id]");
}

// A copy that reads like the span (same prototype, so spanContext() and the rest still work).
function redactSpan(span: ReadableSpan): ReadableSpan {
  return Object.create(span, {
    name: { value: redactString(spanName(span.name)) },
    attributes: { value: redactAttributes(span.attributes) },
    events: { value: span.events.map((event) => ({ ...event, attributes: event.attributes && redactAttributes(event.attributes) })) },
  });
}

export class RedactingSpanExporter implements SpanExporter {
  private readonly inner: SpanExporter;
  constructor(inner: SpanExporter) {
    this.inner = inner;
  }
  export(spans: ReadableSpan[], done: Parameters<SpanExporter["export"]>[1]) {
    this.inner.export(spans.map(redactSpan), done);
  }
  shutdown() {
    return this.inner.shutdown();
  }
  forceFlush() {
    return this.inner.forceFlush?.() ?? Promise.resolve();
  }
}

// The OTel env format: "Authorization=Basic%20abc,X-Other=1".
export function parseHeaders(raw = "") {
  return Object.fromEntries(
    raw.split(",").filter(Boolean).map((pair) => {
      const at = pair.indexOf("=");
      return [pair.slice(0, at).trim(), decodeURIComponent(pair.slice(at + 1).trim())];
    }),
  );
}

// One export path, redacted. Never "auto": with OTEL_EXPORTER_OTLP_ENDPOINT set, @vercel/otel's auto
// exporter sends every span a second time, unredacted. No endpoint (dev, CI): nothing is sent.
export function spanProcessors(env: Record<string, string | undefined> = process.env): SpanProcessor[] {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return [];
  const exporter = new OTLPHttpProtoTraceExporter({ url: `${endpoint}/v1/traces`, headers: parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS) });
  return [new BatchSpanProcessor(new RedactingSpanExporter(exporter))];
}

// Who is acting, on the current span; TraceQL finds the whole trace through it (owner, 2026-10-07).
// A demo login is anonymous: its email is empty, so it's tagged by ID only.
export function userAttributes(claims: { sub: string; email?: string | null }): Attributes {
  return { "user.id": claims.sub, ...(claims.email ? { "user.email": claims.email } : {}) };
}

export function tagUser(claims: { sub: string; email?: string | null }) {
  trace.getActiveSpan()?.setAttributes(userAttributes(claims));
}

// Logs get the same cleaning as spans: a copy with the secrets masked.
function redactLog(record: ReadableLogRecord): ReadableLogRecord {
  return Object.create(record, {
    body: { value: typeof record.body === "string" ? redactString(record.body) : record.body },
    attributes: { value: redactAttributes(record.attributes as Attributes) },
  });
}

export class RedactingLogExporter implements LogRecordExporter {
  private readonly inner: LogRecordExporter;
  constructor(inner: LogRecordExporter) {
    this.inner = inner;
  }
  export(records: ReadableLogRecord[], done: Parameters<LogRecordExporter["export"]>[1]) {
    this.inner.export(records.map(redactLog), done);
  }
  shutdown() {
    return this.inner.shutdown();
  }
  forceFlush() {
    return this.inner.forceFlush();
  }
}

// Kept so flushLogs can reach it: @vercel/otel flushes spans when a request ends, not logs.
let logProcessor: LogRecordProcessor | undefined;

// The same endpoint and headers as traces (the exporter reads the OTEL_EXPORTER_OTLP_* env itself).
export function logRecordProcessors(env: Record<string, string | undefined> = process.env): LogRecordProcessor[] {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return [];
  logProcessor = new BatchLogRecordProcessor({ exporter: new RedactingLogExporter(new OTLPLogExporter()) });
  return [logProcessor];
}

type Level = "INFO" | "WARN" | "ERROR";

// One wide event per action: who, what, for whom, and how it ended (empty fields left out). It carries
// the active trace's id, so Grafana links the log line and its trace both ways.
export function logEvent(name: string, fields: Attributes, level: Level = "INFO") {
  const attributes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null));
  logs.getLogger("keepup").emit({
    eventName: name,
    severityNumber: SeverityNumber[level],
    severityText: level,
    body: name,
    attributes: { "event.name": name, ...attributes },
  });
}

// Call at the end of an after() callback: Vercel may freeze the function once the response is sent.
export function flushLogs() {
  return logProcessor?.forceFlush() ?? Promise.resolve();
}
