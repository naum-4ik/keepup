import { SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import { after } from "next/server";
import { flushLogs, logEvent } from "@/lib/telemetry";

// Vercel may freeze the function once the response is out: send what was logged before that.
function flushAfterResponse() {
  try {
    after(flushLogs);
  } catch {
    // Outside a request (tests, build): nothing to flush.
  }
}

// An unexpected failure. Still printed for Vercel's log; also a keepup.error event (ERROR, with its trace)
// and the request's span marked failed, so Tempo's "Errors" filter finds it.
export function logError(context: string, detail?: string, fields: Attributes = {}) {
  console.error(context, ...(detail === undefined ? [] : [detail]));
  trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR, message: context });
  logEvent("keepup.error", { "error.context": context, "error.message": detail, ...fields }, "ERROR");
  flushAfterResponse();
}
