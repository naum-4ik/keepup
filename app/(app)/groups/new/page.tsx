import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NewGroupForm } from "@/components/groups/new-group-form";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { cityOf } from "@/lib/timezones";

export default async function NewGroupPage() {
  const { profile } = await getProfile();
  const t = await getTranslations("groups");
  return (
    <section className="flex flex-col gap-3 pt-2 pb-6">
      <Link href="/groups" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        {t("title")}
      </Link>
      <h1 className="text-xl font-bold">{t("newGroup")}</h1>
      <NewGroupForm city={cityOf(profile.timezone)} />
    </section>
  );
}
