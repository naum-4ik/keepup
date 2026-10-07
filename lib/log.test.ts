import { afterEach, describe, expect, it, vi } from "vitest";
import { context, ROOT_CONTEXT, SpanStatusCode, trace, type ContextManager } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { logError } from "./log";

const memory = new InMemoryLogRecordExporter();
logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter: memory })] }));

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

afterEach(() => {
  memory.reset();
  vi.restoreAllMocks();
});

describe("logError: an unexpected failure", () => {
  it("still prints it, and sends a keepup.error event at ERROR with what failed", () => {
    const print = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("week_overview failed", "connection reset");
    expect(print).toHaveBeenCalledWith("week_overview failed", "connection reset");
    const [record] = memory.getFinishedLogRecords();
    expect(record.severityText).toBe("ERROR");
    expect(record.attributes).toMatchObject({ "event.name": "keepup.error", "error.context": "week_overview failed", "error.message": "connection reset" });
  });

  it("marks the request's span failed and links the event to its trace", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const spans = new InMemorySpanExporter();
    const span = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(spans)] }).getTracer("test").startSpan("GET /today");
    context.with(trace.setSpan(context.active(), span), () => logError("inbox_feed failed"));
    span.end();
    expect(spans.getFinishedSpans()[0].status).toEqual({ code: SpanStatusCode.ERROR, message: "inbox_feed failed" });
    expect(memory.getFinishedLogRecords()[0].spanContext?.traceId).toBe(span.spanContext().traceId);
  });
});
