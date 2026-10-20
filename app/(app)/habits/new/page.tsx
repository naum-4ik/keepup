import { getTranslations } from "next-intl/server";
import { HabitForm, type FormGroup } from "@/components/habits/habit-form";
import { getProfile } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { isGroupKind } from "@/lib/group-schema";
import { getGroupDetail, getMyGroups } from "@/lib/groups";
import { getGroupTimezones } from "@/lib/habits";

export default async function NewHabitPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const [{ profile }, { group }, myGroups, t] = await Promise.all([getProfile(), searchParams, getMyGroups(), getTranslations("habits.new")]);
  // Only admins create group habits; children (for the "Include" toggles) come from the group detail.
  const admin = myGroups.filter((g) => g.role === "admin");
  // A group habit starts on its group's calendar; zones fail soft to the person's own.
  // Both need only the admin groups, so the zones and the groups' children load together.
  const [zones, children] = await Promise.all([
    getGroupTimezones(admin.map((g) => g.group_id)),
    Promise.all(admin.map(async (g) => (g.child_count > 0 ? ((await getGroupDetail(g.group_id))?.children ?? []) : []))),
  ]);
  const groups: FormGroup[] = admin.map((g, i) => ({
    id: g.group_id,
    name: g.name,
    kind: isGroupKind(g.kind) ? g.kind : "other",
    today: todayIn(zones.get(g.group_id) ?? profile.timezone),
    children: children[i],
  }));
  const initialGroupId = groups.find((g) => g.id === group)?.id;
  return (
    <section className="flex flex-col gap-item py-section">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <HabitForm
        today={todayIn(profile.timezone)}
        weekStart={profile.week_start === 0 ? 0 : 1}
        groups={groups}
        initialGroupId={initialGroupId}
      />
    </section>
  );
}
