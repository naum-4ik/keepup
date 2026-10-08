import { AVATAR_COLORS, initialOf, isAvatarColor } from "@/lib/avatars";
import { cn } from "@/lib/utils";

const SIZE = { sm: "size-7 text-sm", md: "size-11 text-xl", lg: "size-16 text-3xl" } as const;

export function Avatar({
  name,
  emoji,
  color,
  size = "sm",
  label,
  className,
  children,
}: {
  name: string;
  // The accessible name when it should say more than the name (e.g. "Anna: done").
  label?: string;
  emoji?: string | null;
  color?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
  // Overlays such as a status badge.
  children?: React.ReactNode;
}) {
  const bg = color && isAvatarColor(color) ? AVATAR_COLORS[color] : "bg-accent";
  return (
    <span
      role="img"
      aria-label={label ?? name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold text-accent-foreground",
        SIZE[size],
        bg,
        className,
      )}
    >
      <span aria-hidden>{emoji || initialOf(name)}</span>
      {children}
    </span>
  );
}
