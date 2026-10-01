export const GENERIC_ERROR = "Something went wrong. Try again.";

const MESSAGES: Record<string, string> = {
  group_not_found: "That group isn't available.",
  not_admin: "Only a group admin can do that.",
  not_an_adult: "Only adults can do that.",
  invite_invalid: "This invite link has expired or was turned off. Ask for a new one.",
  last_admin: "Make someone else an admin first.",
  children_would_be_deleted: "The children's profiles and history would be deleted. Export or move them first.",
  use_leave: "Use Leave group to remove yourself.",
  guardian_required: "Please confirm you're this child's parent or guardian.",
  same_group: "They're already in that group.",
  goal_exists: "There's already a goal. Finish or cancel it first.",
  goal_not_found: "That goal isn't available.",
  goal_not_reached: "Not reached yet.",
  member_not_found: "That person isn't in this group.",
  invalid_role: "Pick admin or member.",
  not_a_child: "That's only for a child's profile.",
  own_check_in: "Someone else in the group approves your check-ins.",
  already_reviewed: "Someone already reviewed this check-in.",
  review_closed: "The time to review this check-in has passed.",
  invalid_card: "That card isn't available.",
  child_not_found: "That child isn't in this group.",
  category_required: "Pick a category.",
  target_reached: "Already done for this period.",
  already_checked_in_today: "Already checked in today. Come back tomorrow.",
  habit_frozen: "This habit is paused.",
  habit_archived: "This habit is archived.",
  habit_not_found: "That habit isn't available.",
  check_in_not_found: "That check-in isn't available.",
  period_closed: "That period has ended, so it can't be changed.",
  habit_has_history: "This habit has check-ins, so it can only be archived.",
  freeze_in_past: "A pause can't start in the past.",
  start_in_past: "The start date can't be in the past.",
  start_too_far: "Pick a start date within the next year.",
  start_locked: "The start date can't change after the first check-in.",
  habit_not_started: "This habit hasn't started yet.",
  freeze_overlaps: "This habit is already paused then.",
  freeze_range_invalid: "The end date must be on or after the start date.",
  not_authenticated: "Please sign in again.",
  end_too_early: "The end can move later or be removed, not earlier.",
  habit_ended: "This habit has ended. Keep going or finish it from Today.",
  habit_not_ended: "This habit hasn't ended yet.",
  end_passed: "This habit has ended, so its end can't change. Keep going or finish it from Today.",
  bad_range: "Pick a valid date range (up to two months).",
  not_archived: "This habit is already active.",
  habit_finished: "This habit is finished. Use Start again instead.",
  already_nudged: "You've already nudged them about this today.",
  cannot_nudge: "They're all set for now.",
  cannot_cheer: "You can cheer other people's check-ins.",
  invalid_category: "That setting isn't available.",
  invalid_choice: "Pick one of the options.",
  invalid_subscription: "This device couldn't be set up for notifications.",
  invalid_time: "Pick a time on the quarter hour.",
};

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
export const alreadyReviewedNote = (reviewer?: string): string =>
  reviewer ? `${reviewer} already reviewed this.` : "Someone already reviewed this.";

// Check constraints (23514) aren't keepup: codes; the ones a person can hit get their own copy.
const CONSTRAINTS: Record<string, string> = {
  habits_ends_after_start_check: "The last day can't be before the first day.",
};

export function habitErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  if (error?.code === "23514" || error?.message?.includes("violates check constraint")) {
    const name = Object.keys(CONSTRAINTS).find((c) => error.message?.includes(c));
    if (name) return CONSTRAINTS[name];
  }
  const code = errorCode(error);
  return (code && MESSAGES[code]) || GENERIC_ERROR;
}
