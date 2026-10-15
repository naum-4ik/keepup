import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { MAX_STARTER_HABITS, onboardingTemplates } from "@/lib/habit-templates";
import { isUuid } from "@/lib/habit-schema";
import { getHabitSummaries } from "@/lib/habits";
import { getMyGroups } from "@/lib/groups";
import { parsePurpose } from "@/lib/profile-schema";
import { PickHabits } from "../pick-habits";
import { logError } from "@/lib/log";

export default async function PickHabitsPage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  const { t, rich } = await getT();
  const { supabase, userId, profile } = await getProfile();
  if (!profile.onboarded_at) redirect("/onboarding");
  const { joined } = await searchParams;
  const group = joined && isUuid(joined) ? (await getMyGroups()).find((g) => g.group_id === joined) : undefined;
  const today = group ? `/today?joined=${group.group_id}` : "/today";

  // Step 2 is for starting out; anyone who already has habits adds more from the new-habit screen.
  // Own habits only: members can also read their groups' habits.
  const { count } = await supabase.from("habits").select("id", { count: "exact", head: true }).eq("owner_id", userId);
  if ((count ?? 0) > 0) redirect(today);

  const purpose = parsePurpose(profile.purpose ?? "");
  const templates = onboardingTemplates(purpose.ok ? purpose.value : null);

  if (group) {
    // Only the heading's count: on an error it reads as none rather than failing the page.
    const summaries = await getHabitSummaries().catch((e: Error) => {
      logError(e.message);
      return [];
    });
    const together = summaries.filter((h) => h.group_id === group.group_id && !h.archived_at).length;
    return (
      <main className="mx-auto max-w-md px-4 pt-10">
        <h1 className="text-2xl font-bold">
          {together > 0 ? rich("onboarding.habits.joinedTogether", { group: group.name, n: together }) : t("onboarding.habits.joinedEmpty")}
        </h1>
        <p className="mb-5 text-sm text-muted-foreground">{t("onboarding.habits.joinedSubtitle", { max: MAX_STARTER_HABITS })}</p>
        <PickHabits templates={templates} joined={group.group_id} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-10">
      <h1 className="text-2xl font-bold">{t("onboarding.habits.title", { max: MAX_STARTER_HABITS })}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t("onboarding.habits.subtitle")}</p>
      <PickHabits templates={templates} />
    </main>
  );
}
