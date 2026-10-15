import type { NudgeKind } from "@/lib/notification-copy";

// The label of each is `feed.nudgeLabel.<kind>`.
export const NUDGE_KINDS: readonly { kind: NudgeKind; emoji: string }[] = [
  { kind: "thinking_of_you", emoji: "👋" },
  { kind: "you_got_this", emoji: "💪" },
  { kind: "gentle_reminder", emoji: "⏰" },
];
