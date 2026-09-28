import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { appVersion } from "@/lib/version";

function initial(name: string) {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

export default async function ProfilePage() {
  const { profile } = await getProfile();
  const hour = String(profile.reminder_hour).padStart(2, "0");

  return (
    <section className="flex flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground">
          {initial(profile.display_name)}
        </div>
        <div>
          <h1 className="text-xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.timezone.replaceAll("_", " ")} · reminders at {hour}:00
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="h-11">
        <Link href="/profile/settings">Settings</Link>
      </Button>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-11 w-full">
          Sign out
        </Button>
      </form>
      <footer className="text-center text-xs text-muted-foreground">
        <Link href="/whats-new" className="font-mono underline-offset-4 hover:underline">
          {appVersion()}
        </Link>
      </footer>
    </section>
  );
}
