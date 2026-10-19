import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// The one card (docs/design.md "Surfaces"): only for an object you can pick, compare or open (a habit,
// a group, a recap, a template). Static text, a single stat or a headed group of controls is a
// Section or a Notice, never a Surface. `as="a"` is an in-app link (next/link); `as="button"` a picker
// tile; `as="li"` a row in a list of objects. Inner padding is the item level (16px).
const base = "rounded-2xl bg-card p-item text-card-foreground shadow-soft";
const tappable = "block w-full text-start hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type SurfaceProps =
  | ({ as?: "div" } & ComponentProps<"div">)
  | ({ as: "li" } & ComponentProps<"li">)
  | ({ as: "a" } & ComponentProps<typeof Link>)
  | ({ as: "button" } & ComponentProps<"button">);

// Props without `as`, so the element gets only its own attributes.
function omitAs<P extends { as?: unknown }>(props: P): Omit<P, "as"> {
  const rest = { ...props };
  delete rest.as;
  return rest;
}

export function Surface(props: SurfaceProps) {
  switch (props.as) {
    case "a": {
      const { className, ...rest } = omitAs(props);
      return <Link className={cn(base, tappable, className)} {...rest} />;
    }
    case "button": {
      const { className, type = "button", ...rest } = omitAs(props);
      return <button type={type} className={cn(base, tappable, className)} {...rest} />;
    }
    case "li": {
      const { className, ...rest } = omitAs(props);
      return <li className={cn(base, className)} {...rest} />;
    }
    default: {
      const { className, ...rest } = omitAs(props);
      return <div className={cn(base, className)} {...rest} />;
    }
  }
}
