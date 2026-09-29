import { HabitForm } from "@/components/habits/habit-form";
import { getProfile } from "@/lib/auth";
import { todayIn } from "@/lib/dates";

export default async function NewHabitPage() {
  const { profile } = await getProfile();
  return (
    <section className="flex flex-col gap-3 pt-4 pb-6">
      <h1 className="text-xl font-bold">New habit</h1>
      <HabitForm today={todayIn(profile.timezone)} weekStart={profile.week_start === 0 ? 0 : 1} />
    </section>
  );
}
