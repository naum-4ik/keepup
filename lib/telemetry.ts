import { BatchSpanProcessor, type ReadableSpan, type SpanExporter, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { trace, type Attributes, type AttributeValue } from "@opentelemetry/api";
import { OTLPHttpProtoTraceExporter } from "@vercel/otel";

export const REDACTED = "[REDACTED]";

// Keys whose whole value is a secret, and secrets that can hide inside any string: the sign-in
// code and tokens in URLs, JWTs, Grafana and Supabase secret keys. Emails and IDs pass (owner, 2026-10-07).
const SECRET_KEY = /authorization|cookie|password|secret|token|api[-_]?key/i;
const SECRET_PARAM = /([?&](?:code|access_token|refresh_token|token|apikey|password)=)[^&#\s]+/gi;
const SECRET_VALUE = /eyJ[\w-]+\.[\w-]+\.[\w-]+|glc_[\w=+/-]+|sb_secret_[\w-]+/g;

export function redactString(value: string) {
  return value.replace(SECRET_PARAM, `$1${REDACTED}`).replace(SECRET_VALUE, REDACTED);
}

function redactValue(key: string, value: AttributeValue | undefined) {
  if (SECRET_KEY.test(key)) return REDACTED;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? redactString(v) : v)) as AttributeValue;
  return value;
}

export function redactAttributes(attributes: Attributes): Attributes {
  return Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, redactValue(key, value)]));
}

// A copy that reads like the span (same prototype, so spanContext() and the rest still work).
function redactSpan(span: ReadableSpan): ReadableSpan {
  return Object.create(span, {
    name: { value: redactString(span.name) },
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
