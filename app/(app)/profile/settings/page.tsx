import { ProfileForm } from "@/components/profile-form";
import { getProfile } from "@/lib/auth";
import { listTimezones } from "@/lib/timezones";
import { updateProfile } from "./actions";

export default async function SettingsPage() {
  const { profile } = await getProfile();

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
            reminderHour: String(profile.reminder_hour),
          }}
          submitLabel="Save"
        />
      </div>
    </section>
  );
}
