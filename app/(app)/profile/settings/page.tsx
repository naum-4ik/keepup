import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NotificationSettingsCard } from "@/components/notifications/notification-settings";
import { CelebrationsSetting } from "@/components/profile/celebrations-setting";
import { ResetMyData } from "@/components/profile/reset-my-data";
import { ProfileForm } from "@/components/profile-form";
import { getProfile } from "@/lib/auth";
import { getCelebrationMode } from "@/lib/celebrations-data";
import { getHabitSummaries } from "@/lib/habits";
import { getNotificationSettings } from "@/lib/notification-settings";
import { listTimezones } from "@/lib/timezones";
import { updateProfile } from "./actions";

export default async function SettingsPage() {
  const [{ profile }, notifications, celebrations, summaries] = await Promise.all([
    getProfile(),
    getNotificationSettings(),
    getCelebrationMode(),
    getHabitSummaries(),
  ]);
  // Reset my data drops what waits on the phone for these (the habits it removes) before it runs.
  const privateHabitIds = summaries.filter((h) => !h.group_id).map((h) => h.habit_id);

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
      <NotificationSettingsCard settings={notifications} />
      <CelebrationsSetting saved={celebrations} />
      <ResetMyData privateHabitIds={privateHabitIds} />
    </section>
  );
}
