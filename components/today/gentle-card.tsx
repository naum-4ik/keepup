"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Baby, UserPlus, X } from "lucide-react";
import { dismissCard, startInviteGroup } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import type { GentleCard as GentleCardData } from "@/lib/today-cards";

// ideas/onboarding.md → the gentle cards after the first check-in. One at a time, dismissable.
const COPY = {
  invite_family: { title: "Invite your family", body: "Share habits like family dinner. Done when everyone's done.", cta: "Invite" },
  invite_friend: { title: "Invite a friend", body: "Do a habit together and cheer each other on.", cta: "Invite" },
  add_child: { title: "Add a child? 🐼", body: "Track brushing teeth, reading together and more.", cta: "Add a child" },
} as const;

export function GentleCard({ card }: { card: GentleCardData }) {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (hidden) return null;

  const copy = "groupId" in card ? COPY.add_child : COPY[card.key];
  const Icon = "groupId" in card ? Baby : UserPlus;
  const invite = () =>
    startTransition(async () => {
      const result = await startInviteGroup(card.key === "invite_family" ? "family" : "friends");
      if (result) setError(result.message);
    });

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-soft">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FBE6E8] text-[#C2505F] dark:bg-[#C2505F]/20">
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-bold">{copy.title}</p>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <div className="pt-2">
          {"groupId" in card ? (
            <Button asChild size="lg" className="h-11 px-4">
              <Link href={`/kids/new?group=${card.groupId}`}>{copy.cta}</Link>
            </Button>
          ) : (
            <Button size="lg" className="h-11 px-4" disabled={pending} onClick={invite}>
              {copy.cta}
            </Button>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <button
        type="button"
        aria-label="Not now"
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
