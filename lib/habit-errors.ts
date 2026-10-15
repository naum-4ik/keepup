import { isolate, type T } from "@/supabase/functions/_shared/i18n";

// The rule names a database function raises ("keepup:<code>"); each has an errors.<code> message.
// lib/habit-errors.test.ts keeps this list and the catalog in step.
export const ERROR_CODES = [
  "group_not_found", "not_admin", "not_an_adult", "invite_invalid",
  "last_admin", "children_would_be_deleted", "use_leave", "guardian_required",
  "invalid_name", "same_group", "goal_exists", "goal_not_found",
  "goal_not_reached", "member_not_found", "invalid_role", "not_a_child",
  "own_check_in", "already_reviewed", "review_closed", "invalid_card",
  "child_not_found", "category_required", "target_reached", "already_checked_in_today",
  "habit_frozen", "habit_archived", "habit_not_found", "check_in_not_found",
  "period_closed", "habit_has_history", "freeze_in_past", "start_in_past",
  "start_too_far", "start_locked", "habit_not_started", "freeze_overlaps",
  "freeze_range_invalid", "not_authenticated", "end_too_early", "habit_ended",
  "habit_not_ended", "end_passed", "bad_range", "not_archived",
  "habit_finished", "already_nudged", "cannot_nudge", "cannot_cheer",
  "invalid_category", "invalid_choice", "invalid_subscription", "invalid_time",
  "tap_in_future",
] as const;
const KNOWN = new Set<string>(ERROR_CODES);

// Said when nothing more specific is known.
export const genericError = (t: T): string => t("errors.generic");

// These errors mean another device (or midnight) already changed the habit; refresh so its card stops
// showing stale data.
export const REFRESH_ON_ERROR = new Set(["target_reached", "already_checked_in_today", "habit_frozen", "habit_archived", "habit_not_found"]);

// The rule name a database function raised ("keepup:<code>"), if any.
export function errorCode(error: { message?: string } | null | undefined): string | undefined {
  return error?.message?.match(/keepup:([a-z_]+)/)?.[1];
}

// already_reviewed carries the first reviewer's display name in the error's DETAIL (only members
// reach it). PostgREST passes DETAIL through as `details`.
export function reviewerOf(error: { message?: string; details?: string | null } | null | undefined): string | undefined {
  return (errorCode(error) === "already_reviewed" && error?.details?.trim()) || undefined;
}

// The Inbox row's note when someone else got there first.
export const alreadyReviewedNote = (t: T, reviewer?: string): string =>
  reviewer ? t("errors.alreadyReviewedBy", { reviewer: isolate(reviewer) }) : t("errors.alreadyReviewedSomeone");

// Check constraints (23514) aren't keepup: codes; the ones a person can hit get their own copy.
const CONSTRAINTS: Record<string, string> = {
  habits_ends_after_start_check: "errors.endsAfterStart",
};

export function habitErrorMessage(t: T, error: { message?: string; code?: string } | null | undefined): string {
  if (error?.code === "23514" || error?.message?.includes("violates check constraint")) {
    const name = Object.keys(CONSTRAINTS).find((c) => error.message?.includes(c));
    if (name) return t(CONSTRAINTS[name]);
  }
  const code = errorCode(error);
  if (code === "demo") return t("demo.off");
  return code && KNOWN.has(code) ? t(`errors.${code}`) : genericError(t);
}
