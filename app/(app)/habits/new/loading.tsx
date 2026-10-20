import { FieldBones, PageSkeleton, TextBone } from "@/components/app-shell/page-skeleton";

// New habit while it loads: the title, then the form. 16 px under the title, as on the page.
export default function Loading() {
  return (
    <PageSkeleton className="gap-item">
      <TextBone size="xl" className="w-36" />
      <FieldBones count={4} />
    </PageSkeleton>
  );
}
