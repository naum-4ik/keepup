import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLocale } from "next-intl/server";
import { NotificationSettingsCard } from "@/components/notifications/notification-settings";
import { CelebrationsSetting } from "@/components/profile/celebrations-setting";
import { LanguageSetting } from "@/components/profile/language-setting";
import { MyData } from "@/components/profile/my-data";
import { ResetMyData } from "@/components/profile/reset-my-data";
import { ProfileForm } from "@/components/profile-form";
import { asLocale, enabledLocales } from "@/i18n/config";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getCelebrationMode } from "@/lib/celebrations-data";
import { getHabitSummaries } from "@/lib/habits";
import { getNotificationSettings } from "@/lib/notification-settings";
import { listTimezones } from "@/lib/timezones";
import { updateProfile } from "./actions";

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

  return (
    <section className="flex flex-col gap-3 pt-2 pb-6">
      <Link href="/profile" className="-ms-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t("nav.profile")}
      </Link>
      <h1 className="text-xl font-bold">{t("settings.title")}</h1>
      {languages.length > 1 && <LanguageSetting current={currentLocale} enabled={languages} />}
      <div className="rounded-2xl bg-card p-6 shadow-soft">
        <ProfileForm
          action={updateProfile}
          timezones={listTimezones()}
          defaults={{
            displayName: profile.display_name,
            timezone: profile.timezone,
            weekStart: String(profile.week_start),
          }}
          submitLabel={t("common.save")}
        />
      </div>
      <NotificationSettingsCard settings={notifications} isDemo={profile.is_demo} />
      <CelebrationsSetting saved={celebrations} />
      <ResetMyData privateHabitIds={privateHabitIds} />
      <MyData isDemo={profile.is_demo} />
    </section>
  );
}
