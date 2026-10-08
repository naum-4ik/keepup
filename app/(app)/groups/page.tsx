import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Plus, Users } from "lucide-react";
import { GroupCard } from "@/components/groups/group-card";
import { addButtonClass } from "@/components/ui/add-button";
import { Button } from "@/components/ui/button";
import { getMyGroups } from "@/lib/groups";

export default async function GroupsPage() {
  const groups = await getMyGroups();

  return (
    <section className="flex flex-col gap-4 pt-4 pb-6">
      <h1 className="text-xl font-bold">Groups</h1>
      {groups.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          action={
            <Button asChild className="h-11">
              <Link href="/groups/new">Create a group</Link>
            </Button>
          }
        >
          Share habits with the people you live and hang out with.
        </EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {groups.map((g) => (
              <li key={g.group_id}>
                <GroupCard group={g} />
              </li>
            ))}
          </ul>
          <Link href="/groups/new" className={addButtonClass}>
            <Plus aria-hidden className="size-4" />
            New group
          </Link>
        </>
      )}
    </section>
  );
}
