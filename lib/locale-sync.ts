import { asLocale, type Locale } from "@/i18n/config";

type In = { profileLocale: string | null; cookieLocale: string | null; detected: Locale; requestLocale: Locale; enabled: Locale[] };
// profiles.locale is the truth; the cookie caches it per device (Review Focus 3). A new profile saves the
// phone's language even if it isn't enabled yet (detected uses all LOCALES), so the rollout env var never
// stamps people as English.
export function localeSync({ profileLocale, cookieLocale, detected, enabled }: In) {
  if (profileLocale === null) {
    const show = asLocale(detected, enabled);
    return { saveToProfile: detected, setCookie: show && show !== cookieLocale ? show : null };
  }
  const wanted = asLocale(profileLocale, enabled);
  if (!wanted || wanted === cookieLocale) return { saveToProfile: null, setCookie: null };
  return { saveToProfile: null, setCookie: wanted };
}
