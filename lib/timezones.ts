export function listTimezones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

export function pickTimezone(candidate: string | null | undefined, allowed: readonly string[]): string {
  return candidate && allowed.includes(candidate) ? candidate : "UTC";
}
