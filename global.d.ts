import type en from "./supabase/functions/_shared/messages/en.json";
import type { Locale } from "./supabase/functions/_shared/i18n";
declare module "next-intl" {
  interface AppConfig { Locale: Locale; Messages: typeof en }
}
