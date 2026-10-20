import { BackTitle, Bone, PageSkeleton } from "@/components/app-shell/page-skeleton";

// Achievements while they load: the back link and title, then the badge grid.
export default function Loading() {
  return (
    <PageSkeleton>
      <BackTitle title="w-36" />
      <div aria-hidden className="grid grid-cols-3 gap-item">
        {Array.from({ length: 9 }, (_, i) => (
          <Bone key={i} className="aspect-square w-full" />
        ))}
      </div>
    </PageSkeleton>
  );
}
