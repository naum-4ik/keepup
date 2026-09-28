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
      <h1 className="text-2xl font-semibold">Welcome to Keepup</h1>
      <p className="mb-6 text-sm text-muted-foreground">A few basics and you&apos;re in.</p>
      <ProfileForm
        action={completeOnboarding}
        timezones={listTimezones()}
        defaults={{
          displayName: profile.display_name,
          timezone: profile.timezone,
          reminderHour: String(profile.reminder_hour),
        }}
        detectTimezone
        submitLabel="Continue"
      />
    </main>
  );
}
