"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { insertHabits } from "@/lib/habit-create";
import { habitErrorMessage } from "@/lib/habit-errors";
import { parseHabit, type HabitInput } from "@/lib/habit-schema";
import { MAX_STARTER_HABITS, onboardingTemplates } from "@/lib/habit-templates";
import { parseOnboarding, parsePurpose, readOnboardingForm, type OnboardingFormState } from "@/lib/profile-schema";
import { saveProfile } from "@/lib/profile-update";
import { listTimezones } from "@/lib/timezones";

export type PickHabitsState = { status: "idle" } | { status: "error"; message: string };

export async function completeOnboarding(_prev: OnboardingFormState, formData: FormData): Promise<OnboardingFormState> {
  const values = readOnboardingForm(formData);
  const parsed = parseOnboarding(values, new Set(listTimezones()));
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };

  const { supabase, userId } = await requireUser();
  // Marking onboarded also records terms_accepted_at (server-set, see the migration).
  const message = await saveProfile(supabase, userId, parsed.value, { markOnboarded: true });
  if (message) return { status: "error", message, values };

  redirect("/onboarding/habits");
}

export async function startWithHabits(_prev: PickHabitsState, formData: FormData): Promise<PickHabitsState> {
  const { supabase, profile } = await getProfile();
  if (!profile.onboarded_at) redirect("/onboarding");

  // Back + Start again (or a double submit) must not create a second set.
  const { count, error: countError } = await supabase.from("habits").select("id", { count: "exact", head: true });
  if (countError) return { status: "error", message: "Couldn't add your habits. Try again." };
  if ((count ?? 0) > 0) redirect("/today");

  const purpose = parsePurpose(profile.purpose ?? "");
  const offered = onboardingTemplates(purpose.ok ? purpose.value : null);
  const ids = [...new Set(formData.getAll("templateId").map(String))];
  const picked = offered.filter((t) => ids.includes(t.id));
  if (picked.length === 0 || picked.length !== ids.length || picked.length > MAX_STARTER_HABITS) {
    return { status: "error", message: `Pick 1–${MAX_STARTER_HABITS} habits.` };
  }

  // Same validation as the new-habit screen, each starting today in the user's time zone.
  const startsOn = todayIn(profile.timezone);
  const habits: HabitInput[] = [];
  for (const t of picked) {
    const parsed = parseHabit({ title: t.title, category: t.category, targetCount: String(t.targetCount), period: t.period, startsOn });
    if (!parsed.ok) return { status: "error", message: "Couldn't add your habits. Try again." };
    habits.push(parsed.value);
  }

  const error = await insertHabits(supabase, habits);
  if (error) return { status: "error", message: habitErrorMessage(error) };

  revalidatePath("/today");
  revalidatePath("/progress");
  redirect("/today");
}
