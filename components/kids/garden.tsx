import { GARDEN_STAGES, stageFor, starsToNext } from "@/lib/garden";
import { cn } from "@/lib/utils";

// The week's garden: the stage's emoji layers composed on soil in a soft rounded card. The stage
// comes from the stars (same thresholds as private.garden_stage). No characters, no mascots.
export function GardenPicture({ stars, size = "md", className }: { stars: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const stage = GARDEN_STAGES[stageFor(stars)];
  // The first layer is the soil (🟫), drawn as a band; the rest stand on it.
  const plants = stage.layers.slice(1);
  return (
    <div
      role="img"
      aria-label={stage.label}
      className={cn(
        "relative flex flex-col items-center justify-end overflow-hidden rounded-3xl bg-gradient-to-b from-[#E3F1FA] to-[#E5F2E6] dark:from-[#3B82B8]/20 dark:to-[#4F8A5B]/20",
        { sm: "h-20 w-28 rounded-2xl", md: "h-36 w-full", lg: "h-56 w-full" }[size],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-end justify-center gap-1 leading-none select-none",
          { sm: "text-xl", md: "text-4xl", lg: "text-6xl" }[size],
        )}
      >
        {plants.map((p, i) => (
          <span key={`${p}-${i}`} className={cn(p === "☀️" && "absolute top-2 right-3", (p === "🦋" || p === "🐞") && "-translate-y-1/2")}>
            {p}
          </span>
        ))}
      </span>
      <span
        aria-hidden
        className={cn("relative flex w-full justify-center bg-[#8A6B45]/35 dark:bg-[#8A6B45]/50", { sm: "h-3", md: "h-5", lg: "h-7" }[size])}
      >
        {plants.length === 0 && <span className="absolute -top-1 size-2 rounded-full bg-[#8A6B45]" />}
      </span>
    </div>
  );
}

export function Garden({ stars }: { stars: number }) {
  const stage = GARDEN_STAGES[stageFor(stars)];
  const next = starsToNext(stars);
  return (
    <section aria-label="This week's garden" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">This week&apos;s garden</h2>
      <GardenPicture stars={stars} />
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold">{stage.label}</p>
        <p className="text-sm font-semibold tabular-nums">⭐ {stars} this week</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {next === null ? "The garden is in full bloom 🌷" : `${next} more ${next === 1 ? "star" : "stars"} to the next picture`}
      </p>
    </section>
  );
}
