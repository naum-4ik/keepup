import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AddChildForm } from "@/components/kids/add-child-form";
import { getGroupDetail } from "@/lib/groups";
import { isUuid } from "@/lib/habit-schema";

export default async function NewChildPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group: groupId } = await searchParams;
  if (!groupId || !isUuid(groupId)) notFound();
  const group = await getGroupDetail(groupId);
  if (!group) notFound();

  return (
    <section className="flex flex-col gap-3 pt-2 pb-6">
      <Link
        href={`/groups/${group.id}`}
        className="-ml-2 flex h-11 w-fit max-w-full min-w-0 items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{group.name}</span>
      </Link>
      <h1 className="text-xl font-bold">Add a child</h1>
      {group.my_role === "admin" ? (
        <AddChildForm groupId={group.id} />
      ) : (
        <p className="rounded-2xl bg-card p-5 text-sm shadow-soft">Ask an admin of {group.name} to add a child.</p>
      )}
    </section>
  );
}
