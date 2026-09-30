import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { cityOf } from "@/lib/timezones";
import { appVersion } from "@/lib/version";

export default async function ProfilePage() {
  const { profile } = await getProfile();

  return (
    <section className="flex flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar name={profile.display_name} emoji={profile.avatar_emoji} color={profile.avatar_color} className="size-20 text-4xl font-bold" />
        <div>
          <h1 className="text-xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {cityOf(profile.timezone)} · weeks start {profile.week_start === 0 ? "Sunday" : "Monday"}
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
