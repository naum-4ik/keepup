import { Bone, PageSkeleton, TextBone, TitleRow } from "@/components/app-shell/page-skeleton";

// The month calendar while it loads: the title and back link, the month row, a 6-week grid.
export default function Loading() {
  return (
    <PageSkeleton>
      <TitleRow end="w-16" />
      <div aria-hidden className="flex flex-col gap-item">
        <div className="flex h-11 items-center justify-center">
          <TextBone className="w-28" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }, (_, i) => (
            <Bone key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}
