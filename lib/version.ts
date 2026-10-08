import pkg from "../package.json";

export function formatVersion(version: string, commitSha?: string | null): string {
  const short = commitSha ? commitSha.slice(0, 7) : "dev";
  return `v${version} · ${short}`;
}

export function appVersion(): string {
  return formatVersion(pkg.version, process.env.APP_COMMIT_SHA);
}
