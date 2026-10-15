import "server-only";
import en from "@/supabase/functions/_shared/messages/en.json";
import { LOCALES } from "@/supabase/functions/_shared/i18n";
import { kidTemplateTitlesIn } from "@/lib/kid-templates";

// The kid template titles in every language whose catalog exists (en today; ru and he once their JSON lands).
export async function kidTemplateTitlesAllLocales() {
  const catalogs: Record<string, unknown> = { en };
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    try {
      catalogs[locale] = (await import(`../supabase/functions/_shared/messages/${locale}.json`)).default;
    } catch {
      // No catalog for this language yet.
    }
  }
  return kidTemplateTitlesIn(catalogs);
}
