"use client";

import { pauseMe, resumeMe } from "@/app/(app)/habits/actions";
import { FreezeForm, type PauseKind } from "@/components/habits/freeze-form";
import type { HabitFreeze } from "@/lib/habits";

const JUST_ME: PauseKind = { freeze: pauseMe, unfreeze: resumeMe, me: true };

// A group member's own pause: same dates and rules as the whole-habit pause, for one person.
export function PauseMeForm(props: { habitId: string; today: string; weekStart: 0 | 1; activeFreeze: HabitFreeze | null; paused: boolean }) {
  return <FreezeForm {...props} kind={JUST_ME} />;
}
