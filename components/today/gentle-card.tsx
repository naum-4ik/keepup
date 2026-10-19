"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { dismissCard, startInviteGroup } from "@/app/(app)/today/actions";
import { Notice } from "@/components/ui/notice";
import type { GentleCard as GentleCardData } from "@/lib/today-cards";

// ideas/onboarding.md → the gentle prompts after the first check-in. One at a time, dismissable. A
// Notice, not a card (docs/design.md "Notices"): one sentence with what it gets you, its action inline
// after it (a 44px target kept to the line's height by negative margins), and "Not now".
const COPY_KEY = { invite_family: "inviteFamily", invite_friend: "inviteFriend" } as const;
// -my-3 keeps the 44px target to the line's height; px-1 (4px, off the scale on purpose) is only the
// hover tint's edge around a word inside a sentence, where 8px would read as a gap in the text.
const ACTION = "-my-3 inline-flex min-h-11 items-center rounded-lg px-1 font-bold text-primary underline underline-offset-2 hover:bg-background/60 disabled:no-underline";

export function GentleCard({ card }: { card: GentleCardData }) {
  const t = useTranslations("today.gentle");
  const tg = useTranslations("groups.detail");
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (hidden) return null;

  const copyKey = "groupId" in card ? "addChild" : COPY_KEY[card.key];
  // Success opens the group's invite page (the server action redirects); an error says why under it.
  const invite = () =>
    startTransition(async () => {
      setError(null);
      const result = await startInviteGroup(card.key === "invite_family" ? "family" : "friends");
      if (result) setError(result.message);
    });

  return (
    <div className="flex flex-col gap-inner">
      <Notice
        dismiss={{
          label: t("notNow"),
          onDismiss: () => {
            setHidden(true);
            void dismissCard(card.key);
          },
        }}
      >
        {t(`${copyKey}.body`)}{" "}
        {"groupId" in card ? (
          <Link href={`/kids/new?group=${card.groupId}`} className={ACTION}>
            {tg("addChild")}
          </Link>
        ) : (
          <button type="button" className={ACTION} disabled={pending} onClick={invite}>
            {pending ? t("creating") : t(`${COPY_KEY[card.key]}.cta`)}
          </button>
        )}
      </Notice>
      {error && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
    </div>
  );
}
