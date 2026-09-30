import { HabitForm, type FormGroup } from "@/components/habits/habit-form";
import { getProfile } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { getGroupDetail, getMyGroups } from "@/lib/groups";

export default async function NewHabitPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const [{ profile }, { group }, myGroups] = await Promise.all([getProfile(), searchParams, getMyGroups()]);
  // Only admins create group habits; children (for the "Include" toggles) come from the group detail.
  const groups: FormGroup[] = await Promise.all(
    myGroups
      .filter((g) => g.role === "admin")
      .map(async (g) => ({
        id: g.group_id,
        name: g.name,
        children: g.child_count > 0 ? ((await getGroupDetail(g.group_id))?.children ?? []) : [],
      })),
  );
  const initialGroupId = groups.find((g) => g.id === group)?.id;
  return (
    <section className="flex flex-col gap-3 pt-4 pb-6">
      <h1 className="text-xl font-bold">New habit</h1>
      <HabitForm
        today={todayIn(profile.timezone)}
        weekStart={profile.week_start === 0 ? 0 : 1}
        groups={groups}
        initialGroupId={initialGroupId}
      />
    </section>
  );
}
