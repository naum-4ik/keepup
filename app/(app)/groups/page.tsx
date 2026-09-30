import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { GroupCard } from "@/components/groups/group-card";
import { Button } from "@/components/ui/button";
import { getMyGroups } from "@/lib/groups";

export default async function GroupsPage() {
  const groups = await getMyGroups();

  return (
    <section className="flex flex-col gap-4 pt-4 pb-6">
      <h1 className="text-xl font-bold">Groups</h1>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-soft">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
            <Users className="size-6" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">Share habits with the people you live and hang out with.</p>
          <Button asChild className="h-11">
            <Link href="/groups/new">Create a group</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {groups.map((g) => (
              <li key={g.group_id}>
                <GroupCard group={g} />
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="h-11 gap-1.5">
            <Link href="/groups/new">
              <Plus aria-hidden className="size-4" /> New group
            </Link>
          </Button>
        </>
      )}
    </section>
  );
}
