import { Check, Clock, Snowflake } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { memberStatus, type Member, type MemberStatus } from "@/lib/today-sections";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 6;

// Accessible names and the habit page's status text. Copy stays neutral: only the avatars carry
// who is where (design rule: never name who hasn't done it).
export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  done: "Done",
  pending: "Waiting for approval",
  paused: "Paused",
  open: "Not yet",
  not_required: "Joins next period",
};

// docs/design.md status colours, each with an icon (colour is never the only signal).
const BADGE: Partial<Record<MemberStatus, { Icon: typeof Check; className: string }>> = {
  done: { Icon: Check, className: "bg-[#4F8A5B]" },
  pending: { Icon: Clock, className: "bg-[#D4A017]" },
  paused: { Icon: Snowflake, className: "bg-[#5B8DB8]" },
};

export function MemberAvatar({ member, status, size = "sm" }: { member: Member; status: MemberStatus; size?: "sm" | "md" }) {
  const badge = BADGE[status];
  return (
    <Avatar
      name={member.name}
      emoji={member.avatar_emoji}
      color={member.avatar_color}
      size={size}
      label={`${member.name}: ${MEMBER_STATUS_LABEL[status].toLowerCase()}`}
      className={cn("relative ring-2 ring-card", status === "not_required" && "opacity-50")}
    >
      {badge && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-1 -bottom-1 flex items-center justify-center rounded-full text-white ring-2 ring-card",
            size === "sm" ? "size-3.5" : "size-4.5",
            badge.className,
          )}
        >
          <badge.Icon className={size === "sm" ? "size-2.5" : "size-3"} strokeWidth={3} />
        </span>
      )}
    </Avatar>
  );
}

export function MemberStatusRow({ members, target }: { members: Member[]; target: number }) {
  const shown = members.slice(0, MAX_SHOWN);
  const more = members.length - shown.length;
  return (
    <span className="flex items-center gap-1.5 pt-0.5">
      {shown.map((m) => (
        <MemberAvatar key={m.profile_id} member={m} status={memberStatus(m, target)} />
      ))}
      {more > 0 && <span className="text-xs font-semibold text-muted-foreground">+{more}</span>}
    </span>
  );
}
