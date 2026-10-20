import { BackTitle, FieldBones, PageSkeleton } from "@/components/app-shell/page-skeleton";

// New group while it loads: the back link and title, then the form.
export default function Loading() {
  return (
    <PageSkeleton>
      <BackTitle />
      <FieldBones count={2} />
    </PageSkeleton>
  );
}
