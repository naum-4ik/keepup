import { Bone, PageSkeleton, SectionBones, TextBone } from "@/components/app-shell/page-skeleton";

// A habit while it loads: the back link, its chip and title, this period with the check-in button,
// the streak line and the history grid.
export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex flex-col gap-inner">
        <span aria-hidden className="flex h-11 items-center">
          <Bone className="h-3 w-16" />
        </span>
        <div aria-hidden className="flex items-center gap-item">
          <Bone className="size-14" />
          <span className="flex min-w-0 flex-1 flex-col">
            <TextBone size="xl" className="w-40" />
            <TextBone size="sm" className="w-48" />
          </span>
        </div>
      </div>
      <SectionBones>
        <div aria-hidden className="flex items-center justify-between gap-item">
          <TextBone className="w-36" />
          <Bone className="size-11" />
        </div>
      </SectionBones>
      <TextBone size="sm" className="w-56" />
      <SectionBones heading="w-20">
        <Bone className="h-24 w-full rounded-xl" />
      </SectionBones>
    </PageSkeleton>
  );
}
