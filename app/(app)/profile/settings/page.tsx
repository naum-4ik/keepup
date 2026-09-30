import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { AvatarForm } from "@/components/avatar-form";
import { ProfileForm } from "@/components/profile-form";
import { getProfile } from "@/lib/auth";
import { isAvatarColor } from "@/lib/avatars";
import { listTimezones } from "@/lib/timezones";
import { saveAvatar, updateProfile } from "./actions";

export default async function SettingsPage() {
  const { profile } = await getProfile();
  const color = profile.avatar_color && isAvatarColor(profile.avatar_color) ? profile.avatar_color : null;

  return (
    <section className="flex flex-col gap-8 py-6">
      <h1 className="text-xl font-bold">Settings</h1>
      <div className="rounded-2xl bg-card p-6 shadow-soft">
        <ProfileForm
          action={updateProfile}
          timezones={listTimezones()}
          defaults={{
            displayName: profile.display_name,
            timezone: profile.timezone,
            weekStart: String(profile.week_start),
          }}
          submitLabel="Save"
        />
      </div>
      {/* Collapsed by default: the 24-emoji grid would push the rest of Settings off screen. */}
      <details className="group rounded-2xl bg-card shadow-soft">
        <summary className="flex min-h-16 list-none items-center gap-3 rounded-2xl px-6 py-3 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
          <Avatar name={profile.display_name} emoji={profile.avatar_emoji} color={color} size="md" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-bold">Your avatar</span>
            <span className="text-xs text-muted-foreground">Shown to your groups</span>
          </span>
          <ChevronDown aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-6 pt-1 pb-6">
          <AvatarForm action={saveAvatar} name={profile.display_name} emoji={profile.avatar_emoji ?? null} color={color} />
        </div>
      </details>
    </section>
  );
}
