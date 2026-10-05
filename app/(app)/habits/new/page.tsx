import { HabitForm, type FormGroup } from "@/components/habits/habit-form";
import { getProfile } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { isGroupKind } from "@/lib/group-schema";
import { getGroupDetail, getMyGroups } from "@/lib/groups";
import { getGroupTimezones } from "@/lib/habits";

export default async function NewHabitPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const [{ profile }, { group }, myGroups] = await Promise.all([getProfile(), searchParams, getMyGroups()]);
  // Only admins create group habits; children (for the "Include" toggles) come from the group detail.
  const admin = myGroups.filter((g) => g.role === "admin");
  // A group habit starts on its group's calendar; zones fail soft to the person's own.
  const zones = await getGroupTimezones(admin.map((g) => g.group_id));
  const groups: FormGroup[] = await Promise.all(
    admin.map(async (g) => ({
      id: g.group_id,
      name: g.name,
      kind: isGroupKind(g.kind) ? g.kind : "other",
      today: todayIn(zones.get(g.group_id) ?? profile.timezone),
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
