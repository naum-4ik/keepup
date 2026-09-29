import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { onboardingTemplates } from "@/lib/habit-templates";
import { parsePurpose } from "@/lib/profile-schema";
import { PickHabits } from "../pick-habits";

export default async function PickHabitsPage() {
  const { supabase, profile } = await getProfile();
  if (!profile.onboarded_at) redirect("/onboarding");
  // Step 2 is for starting out; anyone who already has habits adds more from the new-habit screen.
  const { count } = await supabase.from("habits").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirect("/today");

  const purpose = parsePurpose(profile.purpose ?? "");
  return (
    <main className="mx-auto max-w-md px-4 pt-10">
      <h1 className="text-2xl font-bold">Pick 1–3 habits to start</h1>
      <p className="mb-5 text-sm text-muted-foreground">Each starts today. You can change them any time.</p>
      <PickHabits templates={onboardingTemplates(purpose.ok ? purpose.value : null)} />
    </main>
  );
}
