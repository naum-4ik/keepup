import { ListRows, PageSkeleton, SectionBones, TitleRow } from "@/components/app-shell/page-skeleton";

// Past recaps while they load: the title and back link, then the weekly lines (rows, no cards).
export default function Loading() {
  return (
    <PageSkeleton>
      <TitleRow end="w-16" />
      <SectionBones>
        <ListRows count={4} chip="hidden" divided />
      </SectionBones>
    </PageSkeleton>
  );
}
