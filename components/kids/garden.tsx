import { SceneIdle } from "@/components/kids/scene-idle";
import { SceneItems, type Idle, type Landed } from "@/components/kids/scene-items";
import { kidTheme, nextStep, restartDay, restartLine, stageFor, stageLabel, stepLines, type Gender } from "@/lib/garden";
import { isFloatingTheme, sceneItems } from "@/lib/scene-items";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import type { T } from "@/supabase/functions/_shared/i18n";

// The week's picture (ideas/kid-view-next.md §4): the stage's big emoji in the middle with a soft glow,
// in front of the items the taps added, on the stage's own sky. The stage comes from the stars (same
// thresholds as private.garden_stage). No characters, no mascots.
export function GardenPicture({
  t,
  stars,
  size = "md",
  theme,
  className,
  interactive = false,
  dancing = false,
  settling = false,
  idle,
  hidden,
  revealed,
  landed,
}: {
  // The translator of whoever renders this (a server page or a client component).
  t: T;
  stars: number;
  size?: "sm" | "md" | "lg";
  theme?: string | null;
  className?: string;
  // The kid view: items wiggle when tapped, and dance when the day is done.
  interactive?: boolean;
  dancing?: boolean;
  // A new picture is zooming in over the screen (KidPlay); it lands here when that's over.
  settling?: boolean;
  // The kid view only: the scene moves gently by itself ("play"), held still while a tap plays ("pause").
  idle?: Idle;
  // The kid view's big reveal (KidPlay): items still flying in, ones that came that way, the one that just landed.
  hidden?: ReadonlySet<number>;
  revealed?: ReadonlySet<number>;
  landed?: Landed | null;
}) {
  const th = kidTheme(theme);
  const stage = th.stages[stageFor(stars)];
  const floating = isFloatingTheme(th.id);
  // The next picture shows faintly in the corner until the first star (not on album thumbnails: those
  // weeks are over).
  const ghost = size !== "sm" && stars === 0 ? (nextStep(t, stars, th.id)?.icon ?? null) : null;
  return (
    <div
      role="img"
      aria-label={stageLabel(t, th.id, stars)}
      data-scene
      // isolate: the items' and the hero's z-index order the scene only; without it they paint over the
      // fixed tab bar when the picture scrolls under it.
      className={cn(
        "relative isolate flex flex-col items-center justify-end overflow-hidden rounded-3xl bg-gradient-to-b transition-colors duration-700",
        stage.sky,
        { sm: "h-20 w-28 rounded-2xl", md: "h-36 w-full", lg: "h-[28vh] min-h-40 max-h-60 w-full" }[size],
        className,
      )}
    >
      {/* One item per star this week (not on album thumbnails, which show only the picture). */}
      {size !== "sm" && (
        <SceneItems
          items={sceneItems(stars, th.id)}
          size={size}
          interactive={interactive}
          dancing={dancing}
          idle={idle}
          hidden={hidden}
          revealed={revealed}
          landed={landed}
        />
      )}
      {idle && size !== "sm" && <SceneIdle items={sceneItems(stars, th.id)} theme={th.id} paused={idle === "pause"} />}
      {ghost && (
        <span
          aria-hidden
          className={cn("absolute bottom-[18%] right-[12%] leading-none opacity-25 grayscale select-none", { md: "text-3xl", lg: "text-5xl" }[size as "md" | "lg"])}
        >
          {ghost}
        </span>
      )}
      <span
        aria-hidden
        // Floating themes: in the middle of the picture. Standing ones: on the ground, behind the front rows.
        className={cn(
          "pointer-events-none absolute left-1/2 z-[150] -translate-x-1/2 transition-opacity duration-300",
          floating ? "top-[44%] -translate-y-1/2" : size === "sm" ? "bottom-2.5" : "bottom-[20%]",
          settling && "motion-safe:opacity-0",
        )}
      >
        {/* It bobs gently when idle, glow and all. */}
        <span
          data-idle={idle ? "hero" : undefined}
          className={cn("relative block", idle && "animate-idle-bob")}
          style={idle ? { animationDuration: "5s", animationPlayState: idle === "pause" ? "paused" : "running" } : undefined}
        >
          {/* A soft glow behind it, so it reads as the main thing on any sky. */}
          <span className="absolute inset-[-30%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0.35)_45%,rgba(255,255,255,0)_70%)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0.15)_45%,rgba(255,255,255,0)_70%)]" />
          <span
            key={stage.min}
            data-hero
            className={cn(
              "relative block leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)] select-none",
              { sm: "text-4xl", md: "text-7xl", lg: "text-8xl" }[size],
              !settling && size !== "sm" && "motion-safe:animate-item-pop",
            )}
          >
            {stage.icon}
          </span>
        </span>
      </span>
      <span
        aria-hidden
        // Where things stand (garden, dino, town), the ground is a tall strip they stand on in rows.
        className={cn("relative w-full", th.ground, size === "sm" ? "h-3" : floating ? { md: "h-5", lg: "h-7" }[size] : "h-[22%]")}
      />
    </div>
  );
}

export function Garden({ t, stars, theme, weekStart, gender = null }: { t: T; stars: number; theme?: string | null; weekStart?: string; gender?: Gender }) {
  const th = kidTheme(theme);
  const { now, next } = stepLines(t, stars, th.id, gender);
  const title = t(`kidThemes.${th.id}.thisWeek`);
  return (
    <Section title={title}>
      <GardenPicture t={t} stars={stars} theme={th.id} />
      {/* Where it stands, then what's next and when it starts again: one block, lines on line-height. */}
      <div className="flex flex-col">
        <div className="flex items-baseline justify-between gap-inner">
          <p className="font-bold">{now}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{t("kids.garden.stars", { stars })}</p>
        </div>
        {next && <p className="text-sm text-muted-foreground">{next}</p>}
        {weekStart && <p className="text-sm text-muted-foreground">{restartLine(t, th.id, restartDay(weekStart), false, gender)}</p>}
      </div>
    </Section>
  );
}
