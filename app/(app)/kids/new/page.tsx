import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { AddChildForm } from "@/components/kids/add-child-form";
import { Notice } from "@/components/ui/notice";
import { getGroupDetail } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";

export default async function NewChildPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group: groupId } = await searchParams;
  if (!groupId || !isUuid(groupId)) notFound();
  const group = await getGroupDetail(groupId);
  if (!group) notFound();
  const [t, tg] = await Promise.all([getTranslations("kids.new"), getTranslations("groups.detail")]);

  return (
    <div className="flex flex-col gap-section py-section">
      <div className="flex flex-col gap-inner">
        {/* -ms-inner: the chevron lines up with the page edge; 4 px icon to label (one glyph pair). */}
        <Link
          href={`/groups/${group.id}`}
          className="-ms-inner flex h-11 w-fit max-w-full min-w-0 items-center gap-1 rounded-full px-inner text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4 shrink-0 rtl:-scale-x-100" />
          <span className="truncate">{group.name}</span>
        </Link>
        <h1 className="text-xl font-bold">{tg("addChild")}</h1>
      </div>
      {group.my_role === "admin" ? (
        <AddChildForm groupId={group.id} />
      ) : (
        <Notice>{t.rich("askAdmin", { group: group.name, bdi: (c) => <bdi>{c}</bdi> })}</Notice>
      )}
    </div>
  );
}
