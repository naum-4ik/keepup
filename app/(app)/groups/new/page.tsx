import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NewGroupForm } from "@/components/groups/new-group-form";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { cityOf } from "@/lib/timezones";

export default async function NewGroupPage() {
  const { profile } = await getProfile();
  const t = await getTranslations("groups");
  const tn = await getTranslations("nav");
  return (
    <section className="flex flex-col gap-section py-section">
      <div className="flex flex-col gap-inner">
        {/* -ms-inner px-inner: the back link's 44 px target, its words on the page edge; chevron to label 4 px (one glyph pair). */}
        <Link href="/groups" className="-ms-inner flex h-11 w-fit items-center gap-1 rounded-full px-inner text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {tn("groups")}
        </Link>
        <h1 className="text-xl font-bold">{t("newGroup")}</h1>
      </div>
      <NewGroupForm city={cityOf(profile.timezone)} />
    </section>
  );
}
