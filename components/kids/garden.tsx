import { SceneItems } from "@/components/kids/scene-items";
import { kidTheme, restartDay, restartLine, sceneFor, stageFor, starsToNext } from "@/lib/garden";
import { isFloatingTheme, sceneItems } from "@/lib/scene-items";
import { cn } from "@/lib/utils";

// The week's garden: the stage's emoji layers composed on soil in a soft rounded card. The stage
// comes from the stars (same thresholds as private.garden_stage). No characters, no mascots.
export function GardenPicture({
  stars,
  size = "md",
  theme,
  className,
  interactive = false,
  dancing = false,
}: {
  stars: number;
  size?: "sm" | "md" | "lg";
  theme?: string | null;
  className?: string;
  // The kid view: items wiggle when tapped, and dance when the day is done.
  interactive?: boolean;
  dancing?: boolean;
}) {
  const t = kidTheme(theme);
  const stageIndex = stageFor(stars);
  const stage = t.stages[stageIndex];
  // The soil (🟫) is drawn as a band, with a mound at the start; the rest stand on it. The next
  // picture shows faintly beside it until the first star (not on album thumbnails: those weeks are over).
  const { plants, ghost, base } = sceneFor(stars, t.id);
  // Once taps have added items, the scene is no longer empty, so the faint preview steps aside.
  const showGhost = ghost !== null && size !== "sm" && stars === 0;
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
      {/* One item per star this week (not on album thumbnails, which show only the picture). */}
      {size !== "sm" && <SceneItems items={sceneItems(stars, t.id)} size={size} interactive={interactive} dancing={dancing} />}
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
        // Where things stand (garden, dino, town), the ground is a tall strip they stand on in rows.
        className={cn("relative flex w-full justify-center", t.ground, size === "sm" ? "h-3" : isFloatingTheme(t.id) ? { md: "h-5", lg: "h-7" }[size] : "h-[22%]")}
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
