import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "use-intl/core";
import en from "@/supabase/functions/_shared/messages/en.json";
import ru from "@/supabase/functions/_shared/messages/ru.json";
import he from "@/supabase/functions/_shared/messages/he.json";
import type { Rich } from "@/lib/list-nodes";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

const catalogs: Partial<Record<Locale, Record<string, unknown>>> = { en, ru, he };
// Tests only: a translator that throws on a missing key or a broken message.
export function tFor(locale: Locale, messages = catalogs[locale]): T {
  if (!messages) throw new Error(`no catalog for ${locale}`);
  const t = createTranslator({ locale, messages, onError: (e) => { throw e; } });
  return (key, values) => t(key as never, values as never);
}
export const tEn = tFor("en");

// Tests only: the rich-text call, with the <bdi> tag supplied as useT's does.
export function richFor(locale: Locale, messages = catalogs[locale]): Rich {
  if (!messages) throw new Error(`no catalog for ${locale}`);
  const t = createTranslator({ locale, messages, onError: (e) => { throw e; } });
  return (key, values) => t.rich(key as never, { bdi: (c: ReactNode) => createElement("bdi", null, c), ...values } as never);
}
export const richEn = richFor("en");

// Tests only: a node as HTML text (apostrophes unescaped), to assert both the words and the <bdi> wrapping.
export const markup = (node: ReactNode) => renderToStaticMarkup(createElement("p", null, node)).replace(/^<p>|<\/p>$/g, "").replace(/&#x27;/g, "'");
