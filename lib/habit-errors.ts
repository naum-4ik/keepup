export const GENERIC_ERROR = "Something went wrong. Try again.";

const MESSAGES: Record<string, string> = {
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
