export function listTimezones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

export function pickTimezone(candidate: string | null | undefined, allowed: readonly string[]): string {
  return candidate && allowed.includes(candidate) ? candidate : "UTC";
}

// Browsers list some zones under a city's old name; show (and search) the name people use today.
// The saved value stays the listed zone id.
const RENAMED: Record<string, string> = {
  Calcutta: "Kolkata",
  Kiev: "Kyiv",
  Saigon: "Ho Chi Minh City",
  Rangoon: "Yangon",
  Katmandu: "Kathmandu",
  Godthab: "Nuuk",
  Faeroe: "Faroe",
  Truk: "Chuuk",
  Ponape: "Pohnpei",
  Enderbury: "Kanton",
};

export function cityOf(tz: string): string {
  const last = tz.split("/").pop() ?? tz;
  return RENAMED[last] ?? last.replaceAll("_", " ");
}

export type ZoneInfo = {
  id: string;
  city: string;
  region: string;
  offset: string; // "GMT", "GMT+3", "GMT+5:30"
  offsetMinutes: number;
  time: string; // "HH:mm" at the given instant
};

export function describeZone(tz: string, now: Date): ZoneInfo {
  // ICU versions differ on zero: some say "GMT", some "GMT+0". Show "GMT" either way.
  const raw =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const offset = raw === "GMT+0" || raw === "GMT-0" ? "GMT" : raw;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return {
    id: tz,
    city: cityOf(tz),
    region: tz.includes("/") ? tz.split("/")[0] : "",
    offset,
    offsetMinutes: parseOffset(offset.replace(/^GMT/, "")) ?? 0,
    time,
  };
}

// "+3", "-5", "+5:30" → minutes; "" → 0 (plain GMT); anything else → null.
function parseOffset(raw: string): number | null {
  if (raw === "") return 0;
  const m = raw.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -minutes : minutes;
}

const normalize = (s: string) => s.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim();

// Matches the city or region by text, or an exact offset ("+9", "GMT+5:30", "-5"). Cities with a word
// starting with the query come first; then by offset, then city.
export function searchZones(zones: readonly string[], query: string, now: Date): ZoneInfo[] {
  const q = normalize(query).replace("−", "-");
  const offsetQuery = /^(gmt|utc)?\s*[+-]/.test(q) ? parseOffset(q.replace(/^(gmt|utc)\s*/, "")) : null;
  const startsWord = (z: ZoneInfo) => (q !== "" && normalize(z.city).split(/[\s-]/).some((w) => w.startsWith(q)) ? 0 : 1);
  return zones
    .map((tz) => describeZone(tz, now))
    .filter((z) => {
      if (q === "") return true;
      if (offsetQuery !== null) return z.offsetMinutes === offsetQuery;
      return normalize(z.city).includes(q) || normalize(z.region).includes(q);
    })
    .sort((a, b) => startsWord(a) - startsWord(b) || a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city));
}
