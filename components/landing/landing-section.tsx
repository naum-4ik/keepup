import Image from "next/image";
import { cn } from "@/lib/utils";

// The README screenshot script's single size (scripts/readme, sips -Z 1300): every landing picture is this.
const SHOT = { width: 638, height: 1300 };

// One landing section: a phone screenshot and its few lines. Stacked on phones; side by side from sm: up,
// the picture on alternating sides.
export function LandingSection({
  title,
  body,
  image,
  alt,
  flip = false,
}: {
  title: string;
  body: string;
  image: string;
  alt: string;
  flip?: boolean;
}) {
  const id = `landing-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      <div className={cn("text-center sm:flex-1 sm:text-left", flip && "sm:order-2")}>
        <h2 id={id} className="text-2xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </div>
      <Image
        src={image}
        alt={alt}
        width={SHOT.width}
        height={SHOT.height}
        sizes="(min-width: 640px) 240px, 65vw"
        className="h-auto w-[65vw] max-w-60 rounded-3xl border border-border bg-card shadow-sm sm:w-60"
      />
    </section>
  );
}
