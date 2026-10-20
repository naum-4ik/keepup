import { Bone, CardRows, PageSkeleton, TextBone, TitleRow } from "@/components/app-shell/page-skeleton";

// Today while it loads (also the first screen inside the app on a cold start): the title and date,
// the summary line, then habit cards.
export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex flex-col gap-inner">
        <TitleRow end="w-32" />
        <div aria-hidden className="flex items-center gap-inner">
          <Bone className="size-10" />
          <TextBone className="w-48" />
        </div>
      </div>
      <CardRows count={4} />
    </PageSkeleton>
  );
}
