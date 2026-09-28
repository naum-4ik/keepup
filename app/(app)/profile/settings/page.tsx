import { signOut } from "@/app/auth/actions";
import { ProfileForm } from "@/components/profile-form";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { listTimezones } from "@/lib/timezones";
import { updateProfile } from "./actions";

export default async function SettingsPage() {
  const { profile } = await getProfile();

  return (
    <section className="flex flex-col gap-8 py-6">
      <h1 className="text-xl font-semibold">Settings</h1>
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
      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </section>
  );
}
