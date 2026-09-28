import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { marked } from "marked";

// Read at build time so the file never needs to exist on the server.
export const dynamic = "force-static";

export default async function WhatsNewPage() {
  const markdown = await readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
  const html = await marked.parse(markdown);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link href="/profile" className="text-sm font-semibold text-muted-foreground">
        ← Back
      </Link>
      <article
        className="prose prose-neutral mt-4 max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
