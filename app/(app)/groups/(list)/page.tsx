import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getT } from "@/lib/i18n/server";
import { GroupCard } from "@/components/groups/group-card";
import { addButtonClass } from "@/components/ui/add-button";
import { Button } from "@/components/ui/button";
import { getMyGroups } from "@/lib/groups";

export default async function GroupsPage() {
  const { t: tg } = await getT();
  const t = await getTranslations("groups");
  const tn = await getTranslations("nav");
  const groups = await getMyGroups();

  return (
    <section className="flex flex-col gap-section py-section">
      <h1 className="text-xl font-bold">{tn("groups")}</h1>
      {groups.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          action={
            <Button asChild>
              <Link href="/groups/new">{t("list.create")}</Link>
            </Button>
          }
        >
          {t("list.empty")}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-item">
          <ul className="flex flex-col gap-item">
            {groups.map((g) => (
              <li key={g.group_id}>
                <GroupCard group={g} t={tg} />
              </li>
            ))}
          </ul>
          <Link href="/groups/new" className={addButtonClass}>
            <Plus aria-hidden className="size-4" />
            {t("newGroup")}
          </Link>
        </div>
      )}
    </section>
  );
}
