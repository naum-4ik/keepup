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
};

export function habitErrorMessage(error: { message?: string } | null | undefined): string {
  const code = error?.message?.match(/keepup:([a-z_]+)/)?.[1];
  return (code && MESSAGES[code]) || GENERIC_ERROR;
}
