import { Bone, ListRows, PageSkeleton, SectionBones, TextBone } from "@/components/app-shell/page-skeleton";

// Profile while it loads: the avatar, name and summary, centred; the level; the list of places to go.
export default function Loading() {
  return (
    <PageSkeleton>
      <div aria-hidden className="flex flex-col items-center gap-item">
        <Bone className="size-20" />
        <span className="flex flex-col items-center">
          <TextBone size="xl" className="w-32" />
          <TextBone size="sm" className="w-48" />
        </span>
      </div>
      <SectionBones>
        <Bone className="h-2.5 w-full" />
      </SectionBones>
      <ListRows count={4} lines={1} divided />
    </PageSkeleton>
  );
}
