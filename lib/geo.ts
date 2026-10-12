import type { Attributes } from "@opentelemetry/api";
import { headers } from "next/headers";

// Where a sign-up, sign-in or demo start comes from (owner, 2026-10-08): Vercel adds the visitor's IP
// address and the country, region and city it points to on every request. Local dev has none of them.
export async function whereFrom(): Promise<Attributes> {
  try {
    const h = await headers();
    const city = h.get("x-vercel-ip-city");
    const fields = {
      "client.address": h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim(),
      "geo.country.iso_code": h.get("x-vercel-ip-country"),
      "geo.region.iso_code": h.get("x-vercel-ip-country-region"),
      "geo.locality.name": city ? decodeURIComponent(city) : undefined,
    };
    return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => !!entry[1]));
  } catch {
    return {}; // Outside a request (tests, build).
  }
}
