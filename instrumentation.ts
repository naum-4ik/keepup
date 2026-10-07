import { registerOTel } from "@vercel/otel";
import { logRecordProcessors, spanProcessors } from "@/lib/telemetry";

export function register() {
  registerOTel({ serviceName: "keepup", spanProcessors: spanProcessors(), logRecordProcessors: logRecordProcessors() });
}
