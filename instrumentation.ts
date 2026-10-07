import { registerOTel } from "@vercel/otel";
import { spanProcessors } from "@/lib/telemetry";

export function register() {
  registerOTel({ serviceName: "keepup", spanProcessors: spanProcessors() });
}
