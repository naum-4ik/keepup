"use client";

import { useState } from "react";
import { dismissCard } from "@/app/(app)/today/actions";
import { Notice } from "@/components/ui/notice";
import { useT } from "@/lib/i18n/client";

// §7 weekly family recap, on the first day of the group's week: wins only. At the top of the Inbox's
// Activity tab (owner 2026-10-04: no group cards on Today). A sentence with a dismiss: a Notice, not
// a card (docs/design.md "Notices").
export function FamilyRecapCard({ cardKey, group, line }: { cardKey: string; group: string; line: string }) {
  const { t } = useT();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <Notice
      tone="success"
      dismiss={{
        label: t("common.dismiss"),
        onDismiss: () => {
          setHidden(true);
          void dismissCard(cardKey);
        },
      }}
    >
      <bdi>{group}</bdi>
      {t("common.sectionSeparator")}
      {line}
    </Notice>
  );
}
