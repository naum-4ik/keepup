import { redirect } from "next/navigation";
import { DemoBanner } from "@/components/demo/demo-banner";
import { getProfile } from "@/lib/auth";
import { isGroupKind } from "@/lib/group-schema";
import { getMyGroups } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";
import { suggestDisplayName } from "@/lib/name-prefill";
import { listTimezones } from "@/lib/timezones";
import { AboutYouForm } from "./about-you-form";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  const { supabase, profile } = await getProfile();
  const { joined } = await searchParams;
  if (profile.onboarded_at) redirect(joined && isUuid(joined) ? `/today?joined=${joined}` : "/today");

  // Arrived from an invite: only trust a group the user is actually in.
  const group = joined && isUuid(joined) ? (await getMyGroups()).find((g) => g.group_id === joined) : undefined;
  const invitedTo = group && isGroupKind(group.kind) ? { id: group.group_id, name: group.name, kind: group.kind } : undefined;

  const { data } = await supabase.auth.getClaims();
  const meta = data?.claims?.user_metadata ?? {};
  const name = suggestDisplayName({ fullName: meta.full_name, name: meta.name, email: data?.claims?.email }) || profile.display_name;

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      {/* A demo login whose seeding never ran (the tab closed mid-way): a way out to a real account. */}
      {(profile.is_demo || data?.claims?.is_anonymous) && <DemoBanner placement="top" />}
      <h1 className="text-2xl font-bold">Welcome to Keepup</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {invitedTo ? `You're joining ${invitedTo.name}. A little about you first.` : "A little about you, then your first habits."}
      </p>
      <div className="rounded-2xl bg-card p-6 shadow-soft">
        <AboutYouForm
          action={completeOnboarding}
          timezones={listTimezones()}
          invitedTo={invitedTo}
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
