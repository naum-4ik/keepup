import Link from "next/link";

function initial(name: string) {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

export function AppHeader({ displayName }: { displayName: string }) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 pb-3 backdrop-blur"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <Link href="/today" className="font-semibold">
        Keepup
      </Link>
      <Link
        href="/profile"
        aria-label="Profile"
        className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
      >
        {initial(displayName)}
      </Link>
    </header>
  );
}
