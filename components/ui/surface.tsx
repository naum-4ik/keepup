import Link from "next/link";
import type { ComponentProps, MouseEventHandler } from "react";
import { LinkPending } from "@/components/ui/link-pending";
import { cn } from "@/lib/utils";

// The one card (docs/design.md "Surfaces"): only for an object you can pick, compare or open (a habit,
// a group, a recap, a template). So it is always tappable: `as="a"` opens something (next/link, href
// required), `as="button"` picks something (an onClick, or type="submit" in a form). There is no static
// card: static text, a single stat or a headed group of controls is a Section or a Notice. In a list,
// the row is `<li><Surface as="a" …/></li>`. Inner padding is the item level (16px).
const base =
  "relative block w-full rounded-2xl bg-card p-item text-start text-card-foreground shadow-soft hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type ButtonBase = Omit<ComponentProps<"button">, "type" | "onClick">;

export type SurfaceProps =
  | ({ as: "a" } & ComponentProps<typeof Link>)
  | ({ as: "button"; type?: "button"; onClick: MouseEventHandler<HTMLButtonElement> } & ButtonBase)
  | ({ as: "button"; type: "submit"; onClick?: MouseEventHandler<HTMLButtonElement> } & ButtonBase);

export function Surface(props: SurfaceProps) {
  if (props.as === "a") {
    const { as: kind, className, children, ...rest } = props;
    void kind;
    return (
      <Link className={cn(base, className)} {...rest}>
        {children}
        <LinkPending />
      </Link>
    );
  }
  const { as: kind, className, type = "button", ...rest } = props;
  void kind;
  return <button type={type} className={cn(base, className)} {...rest} />;
}
