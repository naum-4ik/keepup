import { LANDING } from "@/lib/landing-copy";
import { appVersion } from "@/lib/version";

// Built by · GitHub · Architecture · version. Privacy joins when /privacy exists (M6 PR 7).
export function LandingFooter() {
  const { builtBy, github, architecture } = LANDING.footer;
  const link = "font-semibold text-primary underline-offset-4 hover:underline";
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>{builtBy}</span>
      <span aria-hidden>·</span>
      <a href={github} className={link}>
        GitHub
      </a>
      <span aria-hidden>·</span>
      <a href={architecture} className={link}>
        Architecture
      </a>
      <span aria-hidden>·</span>
      <span className="font-mono text-xs">{appVersion()}</span>
    </footer>
  );
}
