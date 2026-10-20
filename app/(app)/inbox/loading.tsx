import { ListRows, PageSkeleton, TabsBones, TextBone } from "@/components/app-shell/page-skeleton";

// The Inbox while it loads: the title, the two tabs, then rows.
export default function Loading() {
  return (
    <PageSkeleton>
      <TextBone size="xl" className="w-20" />
      <TabsBones tabs={2} />
      <ListRows count={4} chip="size-11" />
    </PageSkeleton>
  );
}
