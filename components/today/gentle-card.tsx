"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Baby, UserPlus, X } from "lucide-react";
import { dismissCard, startInviteGroup } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import type { GentleCard as GentleCardData } from "@/lib/today-cards";

// ideas/onboarding.md → the gentle cards after the first check-in. One at a time, dismissable.
const COPY_KEY = { invite_family: "inviteFamily", invite_friend: "inviteFriend", add_child: "addChild" } as const;

export function GentleCard({ card }: { card: GentleCardData }) {
  const t = useTranslations("today.gentle");
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (hidden) return null;

  const copyKey = "groupId" in card ? COPY_KEY.add_child : COPY_KEY[card.key];
  const Icon = "groupId" in card ? Baby : UserPlus;
  const invite = () =>
    startTransition(async () => {
      const result = await startInviteGroup(card.key === "invite_family" ? "family" : "friends");
      if (result) setError(result.message);
    });

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-soft">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cat-people-soft text-cat-people">
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-bold">{t(`${copyKey}.title`)}</p>
        <p className="text-sm text-muted-foreground">{t(`${copyKey}.body`)}</p>
        <div className="pt-2">
          {"groupId" in card ? (
            <Button asChild size="lg" className="h-11 px-4">
              <Link href={`/kids/new?group=${card.groupId}`}>{t(`${copyKey}.cta`)}</Link>
            </Button>
          ) : (
            <Button size="lg" className="h-11 px-4" disabled={pending} onClick={invite}>
              {t(`${copyKey}.cta`)}
            </Button>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <button
        type="button"
        aria-label={t("notNow")}
        onClick={() => {
          setHidden(true);
          void dismissCard(card.key);
        }}
        className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  );
}
