import Link from "next/link";

function initial(name: string) {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

export function AppHeader({ displayName }: { displayName: string }) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between bg-background/95 px-4 pb-3 backdrop-blur"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <Link href="/today" className="font-bold">
        <span className="text-foreground">Keep</span>
        <span className="text-primary">up</span>
      </Link>
      <Link
        href="/profile"
        aria-label="Profile"
        className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
      >
        {initial(displayName)}
      </Link>
    </header>
  );
}
