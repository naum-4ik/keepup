import { CardRows, PageSkeleton, TabsBones, TextBone, TitleRow } from "@/components/app-shell/page-skeleton";

// Progress while it loads: the title and Recaps link, the tabs, then a category of habit cards.
export default function Loading() {
  return (
    <PageSkeleton>
      <TitleRow end="w-16" />
      <TabsBones tabs={3} />
      <div className="flex flex-col gap-item">
        <TextBone size="sm" className="w-20" />
        <CardRows count={3} end={false} />
      </div>
    </PageSkeleton>
  );
}
