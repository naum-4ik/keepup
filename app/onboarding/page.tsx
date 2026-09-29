import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getProfile } from "@/lib/auth";
import { listTimezones } from "@/lib/timezones";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const { profile } = await getProfile();
  if (profile.onboarded_at) redirect("/today");

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold">Welcome to Keepup</h1>
      <p className="mb-6 text-sm text-muted-foreground">A few basics and you&apos;re in.</p>
      <div className="rounded-2xl bg-card p-6 shadow-soft">
        <ProfileForm
          action={completeOnboarding}
          timezones={listTimezones()}
          defaults={{
            displayName: profile.display_name,
            timezone: profile.timezone,
            reminderHour: String(profile.reminder_hour),
            weekStart: String(profile.week_start),
          }}
          detectTimezone
          submitLabel="Continue"
        />
      </div>
    </main>
  );
}
