import { Bone, ListRows, PageSkeleton, SectionBones, TextBone } from "@/components/app-shell/page-skeleton";

// A child's page while it loads: the back link, the avatar and name, the Open view button, then habits.
export default function Loading() {
  return (
    <PageSkeleton>
      <div aria-hidden className="flex flex-col gap-item">
        <span className="flex h-11 items-center">
          <Bone className="h-3 w-16" />
        </span>
        <div className="flex items-center gap-item">
          <Bone className="size-16" />
          <span className="flex min-w-0 flex-1 flex-col">
            <TextBone size="xl" className="w-28" />
            <TextBone size="sm" className="w-20" />
          </span>
        </div>
        <Bone className="h-14 w-full rounded-2xl" />
      </div>
      <SectionBones>
        <ListRows count={3} chip="size-10" />
      </SectionBones>
    </PageSkeleton>
  );
}
