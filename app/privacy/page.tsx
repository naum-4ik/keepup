import { readFile } from "node:fs/promises";
import path from "node:path";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { marked } from "marked";

export const metadata: Metadata = { title: "Privacy Policy · Keepup" };

// Rendered once at build time from docs/privacy-policy.md, so the file never has to exist on the server.
export const dynamic = "force-static";

// Public (lib/paths.ts): linked from sign-in, sign-up, onboarding, the demo and Profile, and saved by
// the service worker so it opens offline.
export default async function PrivacyPage() {
  const markdown = await readFile(path.join(process.cwd(), "docs/privacy-policy.md"), "utf8");
  const html = await marked.parse(markdown);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link href="/" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Keepup
      </Link>
      <article
        className="prose prose-neutral mt-2 max-w-none break-words dark:prose-invert prose-h1:text-2xl prose-h2:text-lg prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
