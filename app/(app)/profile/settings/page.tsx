import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { getProfile } from "@/lib/auth";
import { listTimezones } from "@/lib/timezones";
import { updateProfile } from "./actions";

export default async function SettingsPage() {
  const { profile } = await getProfile();

  return (
    <section className="flex flex-col gap-3 pt-2 pb-6">
      <Link href="/profile" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Profile
      </Link>
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
    </section>
  );
}
