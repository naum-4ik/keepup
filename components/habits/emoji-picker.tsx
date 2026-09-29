"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, habitEmoji } from "@/lib/categories";
import { isOneEmoji, type HabitCategory } from "@/lib/habit-schema";
import { emojiSuggestions } from "@/lib/habit-templates";
import { cn } from "@/lib/utils";

// Marks the open panel, so a surrounding Dialog can leave Escape to the picker (see habit-form).
export const EMOJI_PANEL_ATTR = "data-emoji-panel";

// A 44px chip button next to the title that opens an inline panel (not a popover, so it lives
// inside the Dialog's focus trap): ~30 suggestions plus a field for the phone's emoji keyboard.
// `value` "" means none picked: the button shows the category default and the server stores it.
export function EmojiPicker({
  value,
  category,
  onChange,
  error,
  children,
}: {
  value: string;
  category: HabitCategory;
  onChange: (emoji: string) => void;
  error?: string;
  children: ReactNode; // the title input, laid out beside the button
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const ownId = useId();
  const shown = habitEmoji(category, value);
  const draftInvalid = draft.trim() !== "" && !isOneEmoji(draft.trim());

  const close = () => {
    setOpen(false);
    setDraft("");
    buttonRef.current?.focus();
  };
  const pick = (emoji: string) => {
    onChange(emoji);
    close();
  };

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="emoji" value={value} />
      <div className="flex items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          aria-label={`Choose emoji (now ${shown})`}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => (open ? close() : setOpen(true))}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none ring-offset-2 ring-offset-background hover:ring-2 hover:ring-primary/40",
            CATEGORIES[category].chipClass,
            open && "ring-2 ring-primary",
          )}
        >
          <span aria-hidden>{shown}</span>
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {open && (
        <div
          id={panelId}
          {...{ [EMOJI_PANEL_ATTR]: "" }}
          className="flex flex-col gap-3 rounded-2xl border border-input p-2"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
        >
          <div role="group" aria-label="Suggested emoji" className="grid grid-cols-6 gap-1">
            {emojiSuggestions(category).map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={e === shown}
                onClick={() => pick(e)}
                className="flex h-11 w-full items-center justify-center rounded-xl text-2xl leading-none hover:bg-muted aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ownId} className="text-sm font-semibold">Or type your own</Label>
            <Input
              id={ownId}
              value={draft}
              placeholder="One emoji"
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => {
                setDraft(e.target.value);
                if (isOneEmoji(e.target.value.trim())) onChange(e.target.value.trim());
              }}
              onKeyDown={(e) => {
                // Enter would submit the whole habit form; here it only confirms the emoji.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!draftInvalid) close();
                }
              }}
              className="h-11 rounded-xl px-3 text-base"
              aria-invalid={draftInvalid}
              aria-describedby={draftInvalid ? `${ownId}-hint` : undefined}
            />
            {draftInvalid && (
              <p id={`${ownId}-hint`} className="text-sm text-destructive">One emoji only.</p>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
