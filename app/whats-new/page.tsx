import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import pkg from "@/package.json";
import { RELEASES, releaseLabel } from "./releases";

export default function WhatsNewPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 px-4 py-6">
      <Link href="/profile" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Profile
      </Link>
      <h1 className="text-xl font-bold">What&apos;s new</h1>
      {RELEASES.map((r) => (
        <section key={r.version} aria-labelledby={`v${r.version}`} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id={`v${r.version}`} className="font-bold">
              Version {r.version}
            </h2>
            <span className="text-sm text-muted-foreground">{releaseLabel(r, pkg.version)}</span>
          </div>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {r.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
