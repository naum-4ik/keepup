"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { AVATAR_COLOR_LABEL, AVATAR_COLORS, AVATAR_EMOJI, type AvatarColor } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export function AvatarPicker({
  name,
  emoji: initialEmoji,
  color: initialColor,
  options = AVATAR_EMOJI,
  hint = "Pick an animal or a friendly thing. No photos, ever.",
}: {
  name: string;
  emoji?: string | null;
  color?: AvatarColor | null;
  // The emoji to choose from: people get AVATAR_EMOJI, groups GROUP_AVATAR_EMOJI.
  options?: readonly string[];
  hint?: string;
}) {
  const [emoji, setEmoji] = useState(initialEmoji ?? "");
  const [color, setColor] = useState<AvatarColor>(initialColor ?? "peach");
  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="avatarEmoji" value={emoji} />
      <input type="hidden" name="avatarColor" value={color} />
      <div className="flex items-center gap-3">
        <Avatar name={name || "?"} emoji={emoji} color={color} size="lg" />
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div role="group" aria-label="Avatar" className="grid grid-cols-6 gap-1">
        {options.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={e === emoji}
            onClick={() => setEmoji(e)}
            className="flex h-11 w-full items-center justify-center rounded-xl text-2xl leading-none hover:bg-muted aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
          >
            {e}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Background color" className="flex flex-wrap gap-2">
        {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-label={AVATAR_COLOR_LABEL[c]}
            aria-pressed={c === color}
            onClick={() => setColor(c)}
            className={cn(
              "size-11 rounded-full ring-offset-2 ring-offset-background hover:ring-2 hover:ring-primary/40 aria-pressed:ring-2 aria-pressed:ring-primary",
              AVATAR_COLORS[c],
            )}
          />
        ))}
      </div>
    </div>
  );
}
