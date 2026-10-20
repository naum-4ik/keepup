import { BackTitle, FieldBones, PageSkeleton, SectionBones } from "@/components/app-shell/page-skeleton";

// Settings while they load: the back link and title, then the settings groups (sections, no cards).
export default function Loading() {
  return (
    <PageSkeleton>
      <BackTitle title="w-28" />
      <FieldBones count={3} />
      <SectionBones>
        <FieldBones count={1} />
      </SectionBones>
    </PageSkeleton>
  );
}
