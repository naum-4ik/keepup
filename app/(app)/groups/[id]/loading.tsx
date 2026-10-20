import { Bone, ListRows, PageSkeleton, SectionBones, TextBone } from "@/components/app-shell/page-skeleton";

// A group while it loads: the back link, its avatar and name, then its habits and people (rows, no cards).
export default function Loading() {
  return (
    <PageSkeleton>
      <span aria-hidden className="flex h-11 items-center">
        <Bone className="h-3 w-16" />
      </span>
      <div aria-hidden className="flex items-center gap-item">
        <Bone className="size-16" />
        <span className="flex min-w-0 flex-1 flex-col gap-inner">
          <TextBone size="xl" className="w-36" />
          <TextBone size="sm" className="w-24" />
        </span>
      </div>
      <SectionBones>
        <ListRows count={2} chip="size-7" />
      </SectionBones>
      <SectionBones heading="w-20">
        <ListRows count={2} chip="size-11" />
      </SectionBones>
    </PageSkeleton>
  );
}
