import { CardRows, PageSkeleton, TextBone } from "@/components/app-shell/page-skeleton";

// Groups while they load: the title, then group cards.
export default function Loading() {
  return (
    <PageSkeleton>
      <TextBone size="xl" className="w-24" />
      <CardRows count={2} end={false} chip="size-11" />
    </PageSkeleton>
  );
}
