import { Fragment, type ReactNode } from "react";
import { INTL_LOCALE, type Locale } from "@/supabase/functions/_shared/i18n";

// A translator's rich-text call (t.rich) as a plain function, so lib code needn't import a framework.
// The translators that make one (useT, getT, tEn) supply the <bdi> tag.
export type Rich = (key: string, values: Record<string, unknown>) => ReactNode;

// "Mary, Leo and Ada" for visible JSX: each name is its own <bdi> (direction isolation without the
// invisible marks isolate() adds to strings); `render` swaps the default <bdi>{name}</bdi>.
export function listNodes(locale: Locale, names: readonly string[], render: (name: string) => ReactNode = (n) => <bdi>{n}</bdi>): ReactNode {
  const parts = new Intl.ListFormat(INTL_LOCALE[locale], { style: "long", type: "conjunction" }).formatToParts(names);
  return <>{parts.map((p, i) => <Fragment key={i}>{p.type === "element" ? render(p.value) : p.value}</Fragment>)}</>;
}
