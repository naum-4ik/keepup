import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { suggestDisplayName } from "@/lib/name-prefill";
import { listTimezones } from "@/lib/timezones";
import { AboutYouForm } from "./about-you-form";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const { supabase, profile } = await getProfile();
  if (profile.onboarded_at) redirect("/today");

  const { data } = await supabase.auth.getClaims();
  const meta = data?.claims?.user_metadata ?? {};
  const name = suggestDisplayName({ fullName: meta.full_name, name: meta.name, email: data?.claims?.email }) || profile.display_name;

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold">Welcome to Keepup</h1>
      <p className="mb-6 text-sm text-muted-foreground">A little about you, then your first habits.</p>
      <div className="rounded-2xl bg-card p-6 shadow-soft">
        <AboutYouForm
          action={completeOnboarding}
          timezones={listTimezones()}
          defaults={{
            displayName: name,
            timezone: profile.timezone,
            weekStart: String(profile.week_start),
            purpose: profile.purpose ?? "",
          }}
        />
      </div>
    </main>
  );
}
