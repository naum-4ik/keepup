// Type-level checks for the UI primitives, compiled by `npm run typecheck` (never imported or rendered).
// Each @ts-expect-error line is a misuse the types must refuse; if it compiles, typecheck fails.
import { Surface } from "@/components/ui/surface";

export const surfaceChecks = [
  <Surface key="a" as="a" href="/today">ok</Surface>,
  <Surface key="b" as="button" onClick={() => {}}>ok</Surface>,
  <Surface key="c" as="button" type="submit">ok</Surface>,
  // @ts-expect-error no static card: `as` is required
  <Surface key="d">static</Surface>,
  // @ts-expect-error no static card: a div is not a Surface
  <Surface key="e" as="div">static</Surface>,
  // @ts-expect-error a link needs its href
  <Surface key="f" as="a">no href</Surface>,
  // @ts-expect-error a button does something: onClick or type="submit"
  <Surface key="g" as="button">does nothing</Surface>,
];
