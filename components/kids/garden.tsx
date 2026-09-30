import { kidTheme, nextStep, restartDay, restartLine, sceneFor, stageFor, starsToNext } from "@/lib/garden";
import { cn } from "@/lib/utils";

// The week's garden: the stage's emoji layers composed on soil in a soft rounded card. The stage
// comes from the stars (same thresholds as private.garden_stage). No characters, no mascots.
export function GardenPicture({
  stars,
  size = "md",
  theme,
  className,
}: {
  stars: number;
  size?: "sm" | "md" | "lg";
  theme?: string | null;
  className?: string;
}) {
  const t = kidTheme(theme);
  const stageIndex = stageFor(stars);
  const stage = t.stages[stageIndex];
  // The soil (🟫) is drawn as a band, with a mound at the start; the rest stand on it. The next
  // picture shows faintly beside it (not on album thumbnails: those weeks are over).
  const { plants, ghost, base } = sceneFor(stars, t.id);
  const showGhost = ghost !== null && size !== "sm";
  return (
    <div
      role="img"
      aria-label={stage.label}
      className={cn(
        "relative flex flex-col items-center justify-end overflow-hidden rounded-3xl bg-gradient-to-b",
        t.sky,
        { sm: "h-20 w-28 rounded-2xl", md: "h-36 w-full", lg: "h-[28vh] min-h-40 max-h-60 w-full" }[size],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-end justify-center gap-1 leading-none select-none",
          // A seed or a shell is small: half the size, half sunk into the mound.
          base ? { sm: "translate-y-1 text-xs", md: "translate-y-2 text-xl", lg: "translate-y-3 text-3xl" }[size] : { sm: "text-xl", md: "text-4xl", lg: "text-6xl" }[size],
        )}
      >
        {plants.map((p, i) => (
          <span
            key={`${p}-${i}`}
            className={cn(
              // Sky things float top right; the rest are positioned so they paint over the mound.
              p === "☀️" || p === "🌙" || p === "🪐" ? "absolute top-2 right-3" : "relative z-10",
              ["🦋", "🐞", "🐟", "🐡", "🐠", "⭐", "🌟", "☄️"].includes(p) && "-translate-y-1/2",
            )}
          >
            {p}
          </span>
        ))}
      </span>
      {showGhost && (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-[18%] right-[12%] leading-none opacity-25 grayscale select-none",
            { sm: "", md: "text-3xl", lg: "text-5xl" }[size],
          )}
        >
          {ghost}
        </span>
      )}
      <span
        aria-hidden
        className={cn("relative flex w-full justify-center", t.ground, { sm: "h-3", md: "h-5", lg: "h-7" }[size])}
      >
        {stageIndex === 0 && (
          <span className={cn("absolute bottom-full [border-radius:50%_50%_0_0/100%_100%_0_0]", t.ground, { sm: "h-2 w-12", md: "h-4 w-28", lg: "h-7 w-44" }[size])} />
        )}
      </span>
    </div>
  );
}

export function Garden({ stars, theme, weekStart }: { stars: number; theme?: string | null; weekStart?: string }) {
  const t = kidTheme(theme);
  const stage = t.stages[stageFor(stars)];
  const next = starsToNext(stars);
  const title = t.id === "garden" ? "This week's garden" : `This week's ${t.name.toLowerCase()}`;
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
      <GardenPicture stars={stars} theme={t.id} />
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold">{stage.label}</p>
        <p className="text-sm font-semibold tabular-nums">⭐ {stars} this week</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {next === null ? `${stage.label}! ${stage.icon}` : `${next} more ${next === 1 ? "star" : "stars"} to the next picture`}
      </p>
      {weekStart && <p className="text-sm text-muted-foreground">{restartLine(t.id, restartDay(weekStart), false)}</p>}
    </section>
  );
}

// The kid view (ideas/kid-view-next.md §1): a star path from this picture to the next one, which a
// child who can't read yet can follow; a grown-up can read the label out.
export function NextStep({ stars, theme, weekStart }: { stars: number; theme?: string | null; weekStart?: string }) {
  const step = nextStep(stars, theme);
  const day = weekStart ? restartDay(weekStart) : null;
  if (!step) {
    const t = kidTheme(theme);
    const full = t.stages[t.stages.length - 1];
    return (
      <p className="text-center text-xl font-bold text-done">
        {day ? restartLine(theme, day, true) : t.id === "garden" ? "Full garden! 🌻" : `${full.label}! ${full.icon}`}
      </p>
    );
  }
  const label = `${step.left} more ${step.left === 1 ? "star" : "stars"} to ${step.label.toLowerCase()}`;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div role="img" aria-label={label} className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 shadow-soft">
          <span aria-hidden className="flex items-center gap-1">
            {Array.from({ length: step.need }, (_, i) => (
              <span key={i} className={cn("text-3xl leading-none", i < step.have ? "" : "opacity-25 grayscale")}>
                ⭐
              </span>
            ))}
          </span>
          <span aria-hidden className="text-xl text-muted-foreground">→</span>
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-accent text-3xl leading-none">
            {step.icon}
          </span>
        </div>
        {/* For the grown-up reading along; the child counts the stars. */}
        <p aria-hidden className="text-base font-bold">
          {step.left} more ⭐ to {step.icon}
        </p>
      </div>
      {day && <p className="text-sm text-muted-foreground">{restartLine(theme, day, false)}</p>}
    </div>
  );
}
