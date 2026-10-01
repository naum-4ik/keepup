import Link from "next/link";
import { AvatarEdit } from "@/components/avatar-edit";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { isAvatarColor } from "@/lib/avatars";
import { cityOf } from "@/lib/timezones";
import { appVersion } from "@/lib/version";
import { saveAvatar } from "./actions";

export default async function ProfilePage() {
  const { profile } = await getProfile();

  return (
    <section className="flex flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AvatarEdit
          name={profile.display_name}
          emoji={profile.avatar_emoji}
          color={profile.avatar_color && isAvatarColor(profile.avatar_color) ? profile.avatar_color : null}
          action={saveAvatar}
          title="Change your avatar"
          description="Shown to your groups."
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {cityOf(profile.timezone)} · weeks start {profile.week_start === 0 ? "Sunday" : "Monday"}
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="h-11">
        <Link href="/profile/settings">Settings</Link>
      </Button>
      <SignOutButton />
      <footer className="text-center text-xs text-muted-foreground">
        <Link href="/whats-new" className="font-mono underline-offset-4 hover:underline">
          {appVersion()}
        </Link>
      </footer>
    </section>
  );
}
