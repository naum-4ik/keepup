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

// Big, recognisable cities, most familiar first. Each time row saves one of these unless the saved or
// device zone shares that time, so a row follows a real city's clock changes.
const WELL_KNOWN = [
  "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Phoenix",
  "America/Chicago", "America/Mexico_City", "America/New_York", "America/Toronto", "America/Halifax",
  "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "America/St_Johns", "Atlantic/Azores",
  "Europe/London", "Europe/Lisbon", "UTC", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid",
  "Africa/Lagos", "Asia/Jerusalem", "Europe/Athens", "Africa/Cairo", "Africa/Johannesburg", "Europe/Kiev",
  "Europe/Moscow", "Europe/Istanbul", "Asia/Riyadh", "Asia/Dubai", "Asia/Tehran", "Asia/Kabul", "Asia/Karachi",
  "Asia/Calcutta", "Asia/Katmandu", "Asia/Dhaka", "Asia/Rangoon", "Asia/Bangkok", "Asia/Jakarta",
  "Asia/Singapore", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul", "Australia/Adelaide",
  "Australia/Darwin", "Australia/Sydney", "Australia/Brisbane", "Pacific/Noumea", "Pacific/Auckland",
  "Pacific/Fiji", "Pacific/Tongatapu", "Pacific/Kiritimati", "Pacific/Pago_Pago",
];

// One row per local time right now (about 38), sorted by offset. `preferred` (the saved zone, then the
// device's) wins its row; otherwise the most familiar city with that time; otherwise the first by name.
export function timeChoices(zones: readonly string[], now: Date, preferred: readonly string[]): ZoneInfo[] {
  const byOffset = new Map<number, ZoneInfo[]>();
  for (const tz of zones) {
    const z = describeZone(tz, now);
    byOffset.set(z.offsetMinutes, [...(byOffset.get(z.offsetMinutes) ?? []), z]);
  }
  const rank = (id: string) => {
    const p = preferred.indexOf(id);
    if (p !== -1) return p;
    const w = WELL_KNOWN.indexOf(id);
    return w !== -1 ? preferred.length + w : Infinity;
  };
  return [...byOffset.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => group.reduce((best, z) => {
      const d = rank(z.id) - rank(best.id);
      return d < 0 || (d === 0 && z.id < best.id) ? z : best;
    }));
}
