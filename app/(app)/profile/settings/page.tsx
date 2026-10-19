import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLocale } from "next-intl/server";
import { NotificationSettingsCard } from "@/components/notifications/notification-settings";
import { CelebrationsSetting } from "@/components/profile/celebrations-setting";
import { LanguageSetting } from "@/components/profile/language-setting";
import { MyData } from "@/components/profile/my-data";
import { ResetMyData } from "@/components/profile/reset-my-data";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { asLocale, enabledLocales } from "@/i18n/config";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getCelebrationMode } from "@/lib/celebrations-data";
import { getHabitSummaries } from "@/lib/habits";
import { getNotificationSettings } from "@/lib/notification-settings";
import { listTimezones } from "@/lib/timezones";

export default async function SettingsPage() {
  const [{ t }, { profile }, notifications, celebrations, summaries] = await Promise.all([
    getT(),
    getProfile(),
    getNotificationSettings(),
    getCelebrationMode(),
    getHabitSummaries(),
  ]);
  // Reset my data drops what waits on the phone for these (the habits it removes) before it runs.
  const privateHabitIds = summaries.filter((h) => !h.group_id).map((h) => h.habit_id);
  // Hidden until a second language is enabled (KEEPUP_LOCALES); shows the language the page is in.
  const languages = enabledLocales();
  const currentLocale = asLocale(await getLocale(), languages) ?? "en";

  // Settings groups as Sections, 24 px apart, no cards (docs/design.md "Surfaces"). Every setting saves
  // when it changes and says so beside it; the typed name has its own Save, first on the page.
  return (
    <div className="flex flex-col gap-section py-section">
      <div className="flex flex-col gap-inner">
        {/* -ms-inner: the chevron lines up with the page edge; 4 px icon to label (one glyph pair). */}
        <Link href="/profile" className="-ms-inner flex h-11 w-fit items-center gap-1 rounded-full px-inner text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("nav.profile")}
        </Link>
        <h1 className="text-xl font-bold">{t("settings.title")}</h1>
      </div>
      <ProfileSettings
        timezones={listTimezones()}
        saved={{ displayName: profile.display_name, timezone: profile.timezone, weekStart: String(profile.week_start) }}
      />
      {languages.length > 1 && <LanguageSetting current={currentLocale} enabled={languages} />}
      <NotificationSettingsCard settings={notifications} isDemo={profile.is_demo} />
      <CelebrationsSetting saved={celebrations} />
      <ResetMyData privateHabitIds={privateHabitIds} />
      <MyData isDemo={profile.is_demo} />
    </div>
  );
}
