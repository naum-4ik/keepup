import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { appVersion } from "@/lib/version";

export default async function ProfilePage() {
  const { profile } = await getProfile();
  const hour = String(profile.reminder_hour).padStart(2, "0");

  return (
    <section className="flex flex-col gap-6 py-6">
      <div>
        <h1 className="text-xl font-semibold">{profile.display_name}</h1>
        <p className="text-sm text-muted-foreground">
          {profile.timezone.replaceAll("_", " ")} · reminders at {hour}:00
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/profile/settings">Settings</Link>
      </Button>
      <footer className="text-center text-xs text-muted-foreground">
        <Link href="/whats-new" className="underline-offset-4 hover:underline">
          {appVersion()}
        </Link>
      </footer>
    </section>
  );
}
