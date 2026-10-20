import { Bone, PageSkeleton, TextBone } from "@/components/app-shell/page-skeleton";

// The kid view while it loads (no header, no nav, as the view itself): the sound button, the child's
// avatar and name, the garden picture, then big habit tiles. Spacing copies components/kids/kid-play.tsx.
export default function Loading() {
  return (
    <PageSkeleton className="flex-1 gap-5 py-0">
      <div aria-hidden className="flex flex-col gap-inner">
        <div className="flex justify-end">
          <Bone className="size-11" />
        </div>
        <div className="flex items-center gap-item">
          <Bone className="size-16" />
          <TextBone size="xl" className="w-32" />
        </div>
      </div>
      <Bone className="h-[28vh] max-h-60 min-h-40 w-full rounded-3xl" />
      <ul aria-hidden className="grid grid-cols-1 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex min-h-24 items-center gap-4 rounded-3xl bg-card p-4 shadow-soft">
            <Bone className="size-20" />
            <TextBone className="w-32" />
          </li>
        ))}
      </ul>
    </PageSkeleton>
  );
}
