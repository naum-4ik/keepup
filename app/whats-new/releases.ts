// What's new, written for people using Keepup (CHANGELOG.md stays the developer log, owned by
// release-please). Each release: add an entry at the top with 3–5 plain lines about what people
// can now do. No PR numbers, hashes or internals; never guilt; kid copy stays gender-neutral.
// Add the date once the release merges; until then a version newer than the app's says "Coming soon".
// Notes are plain English lines, or per language ({ en, ru, he }; a missing language falls back to en).
import { INTL_LOCALE, type Locale, type T } from "@/supabase/functions/_shared/i18n";

export type Release = { version: string; date?: string; notes: string[] | Partial<Record<Locale, string[]>> };

export function notesFor(r: Release, locale: Locale): string[] {
  return Array.isArray(r.notes) ? r.notes : (r.notes[locale] ?? r.notes.en ?? []);
}

// > 0 when a is newer than b ("0.10.0" vs "0.9.1").
export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export function releaseLabel(r: Release, appVersion: string, locale: Locale, t: T): string {
  const [y, m, d] = (r.date ?? "").split("-").map(Number);
  if (r.date) return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
  return compareVersions(r.version, appVersion) > 0 ? t("whatsNew.comingSoon") : "";
}

export const RELEASES: Release[] = [
  {
    version: "1.10.0",
    notes: {
      en: [
        "A new app icon: a cream sprout on a terracotta tile, easier to spot on your Home Screen. To see it on iPhone, remove Keepup from the Home Screen and add it again.",
        "Easier to read: text, buttons and field borders have stronger contrast, in light and dark mode.",
        "Forms point to what needs fixing: the field is marked, the message sits under it, and the cursor jumps there.",
        "A name typed right after saving is now saved when you press Enter.",
      ],
      ru: [
        "Новая иконка: кремовый росток на терракотовой плитке, её проще найти на экране «Домой». Чтобы увидеть её на iPhone, удалите Keepup с экрана «Домой» и добавьте снова.",
        "Читать проще: у текста, кнопок и рамок полей выше контраст, в светлой и тёмной теме.",
        "Формы показывают, что исправить: поле подсвечено, подсказка под ним, и курсор сразу переходит туда.",
        "Имя, набранное сразу после сохранения, теперь сохраняется по нажатию Enter.",
      ],
      he: [
        "סמל חדש לאפליקציה: נבט בצבע שמנת על אריח טרקוטה, קל יותר למצוא אותו במסך הבית. כדי לראות אותו באייפון, הסירו את Keepup ממסך הבית והוסיפו שוב.",
        "קל יותר לקרוא: לטקסט, לכפתורים ולמסגרות השדות יש ניגודיות חזקה יותר, במצב בהיר ובמצב כהה.",
        "הטפסים מראים מה לתקן: השדה מסומן, ההודעה מופיעה מתחתיו, והסמן עובר אליו.",
        "שם שמקלידים מיד אחרי שמירה נשמר עכשיו בלחיצה על Enter.",
      ],
    },
  },
  {
    version: "1.9.0",
    date: "2026-10-20",
    notes: {
      en: [
        "Tabs and cards answer your tap at once: the next screen appears right away and fills in as it loads.",
        "The installed app has a sharper icon on computers, and the iPhone app opens on a cream screen with the sprout instead of a white one.",
        "A mistyped address now shows \"Page not found\" with a way home, instead of the sign-in screen.",
      ],
      ru: [
        "Вкладки и карточки отвечают на нажатие сразу: следующий экран появляется мгновенно и заполняется по мере загрузки.",
        "У установленного приложения на компьютере более чёткая иконка, а на iPhone приложение открывается с кремовым экраном и ростком вместо белого.",
        "Если адрес набран с ошибкой, теперь откроется «Страница не найдена» со ссылкой на главную, а не экран входа.",
      ],
      he: [
        "כרטיסיות וכרטיסים מגיבים להקשה מיד: המסך הבא מופיע מייד ומתמלא תוך כדי טעינה.",
        "לאפליקציה המותקנת יש סמל חד יותר במחשב, ובאייפון היא נפתחת במסך קרם עם הנבט במקום מסך לבן.",
        "כתובת שגויה מציגה עכשיו „הדף לא נמצא” עם קישור לדף הבית, במקום מסך הכניסה.",
      ],
    },
  },
  {
    version: "1.8.0",
    date: "2026-10-19",
    notes: {
      en: [
        "A calmer, cleaner look: fewer boxes, even spacing, and the first check-in fits on small phones without scrolling.",
        "Every action now tells you what happened: after a check-in you get a short note with Undo, and if something fails, it says what to do next.",
        "Settings save as you change them and show \"Saved ✓\", so there's no Save button to look for.",
        "A kid's name always shows in full in the kid's view, and themes are easier to pick.",
        "The start page loads faster and has one clear button: Start your first streak.",
      ],
      ru: [
        "Спокойнее и чище: меньше рамок, ровные отступы, а первая отметка помещается на маленьком телефоне без прокрутки.",
        "Каждое действие теперь говорит, что произошло: после отметки появляется короткое сообщение с кнопкой «Отменить», а если что-то не получилось, вы увидите, что делать дальше.",
        "Настройки сохраняются сразу, как только вы их меняете, и показывают «Сохранено ✓». Искать кнопку «Сохранить» больше не нужно.",
        "Имя ребёнка в детском режиме всегда видно целиком, а тему стало проще выбрать.",
        "Стартовая страница грузится быстрее, и на ней одна понятная кнопка: «Начать первую серию».",
      ],
      he: [
        "מראה רגוע ונקי יותר: פחות מסגרות, מרווחים אחידים, והסימון הראשון נכנס גם בטלפון קטן בלי לגלול.",
        "כל פעולה מספרת מה קרה: אחרי סימון מופיעה הודעה קצרה עם „ביטול”, ואם משהו נכשל, תראו מה לעשות עכשיו.",
        "ההגדרות נשמרות מיד כשמשנים אותן ומציגות „נשמר ✓”. אין יותר כפתור שמירה שצריך לחפש.",
        "שם הילד מוצג תמיד במלואו בתצוגת הילד, ונעשה קל יותר לבחור ערכת נושא.",
        "דף הפתיחה נטען מהר יותר ויש בו כפתור אחד ברור: „התחילו את הרצף הראשון”.",
      ],
    },
  },
  {
    version: "1.7.0",
    date: "2026-10-19",
    notes: {
      en: ["Keepup now has Terms of use: short, plain rules for using the app. Find them in Profile, at the bottom."],
      ru: ["У Keepup появились Условия использования: короткие и простые правила. Ссылка внизу экрана «Профиль»."],
      he: ["ל-Keepup יש עכשיו תנאי שימוש: כללים קצרים ופשוטים לשימוש באפליקציה. הקישור נמצא בתחתית מסך „פרופיל”."],
    },
  },
  {
    version: "1.6.0",
    date: "2026-10-18",
    notes: {
      en: [
        "The demo (Try the demo) now feels like a real family on any day, and in your language: suggested habits, the family name and the treat goal show in your language, the kid's garden has room to grow, and the Inbox has a cheer and a nudge.",
        "In Russian and Hebrew, Inbox lines about a kid now use the right words for a boy or a girl.",
        "Recaps: hover a day on the month heatmap to see a readable date.",
        "The offline page shows your language right away.",
      ],
      ru: [
        "Демо («Открыть демо») теперь выглядит как настоящая семья в любой день и на вашем языке: подсказки привычек, название семьи и цель-награда показываются на вашем языке, в саду ребёнка есть место для роста, а во Входящих есть похвала и мягкое напоминание.",
        "На русском и иврите строки о ребёнке во Входящих теперь говорят правильно: про мальчика или про девочку.",
        "Итоги: если навести курсор на день в месячной тепловой карте, появится понятная дата.",
        "Страница без интернета сразу показывается на вашем языке.",
      ],
      he: [
        "הדמו („כניסה לדמו”) נראה עכשיו כמו משפחה אמיתית בכל יום, ובשפה שלכם: הרגלים מוצעים, שם המשפחה ויעד הפינוק מוצגים בשפה שלכם, בגינה של הילד יש מקום לצמוח, ובהודעות יש מחמאה ותזכורת עדינה.",
        "ברוסית ובעברית, שורות על ילד בהודעות משתמשות עכשיו במילים הנכונות לבן או לבת.",
        "סיכום: ריחוף על יום במפת החום החודשית מציג תאריך קריא.",
        "דף האופליין מוצג מיד בשפה שלכם.",
      ],
    },
  },
  {
    version: "1.5.0",
    date: "2026-10-18",
    notes: {
      en: [
        "Keepup speaks Russian and Hebrew too. It follows your phone's language; change it any time in Profile → Settings → Language. Hebrew is laid out right to left.",
        "Habits added from Keepup's suggestions show their name in your language. Names you typed yourself stay as you wrote them.",
        "Kids can have boy or girl set (optional), so Russian and Hebrew can say ‘well done’ the right way.",
        "Privacy: Keepup remembers your language on your profile and in a cookie on your device, and a kid's boy or girl if you set it. The privacy policy says so.",
      ],
      ru: [
        "Keepup теперь говорит по-русски и на иврите. Язык берётся из настроек телефона; сменить его можно в «Профиль → Настройки → Язык». Иврит отображается справа налево.",
        "Привычки из подсказок Keepup показываются на вашем языке. Названия, которые вы написали сами, остаются как есть.",
        "Для ребёнка можно указать «мальчик» или «девочка» (по желанию), чтобы по-русски и на иврите хвалить правильно.",
        "Конфиденциальность: Keepup запоминает ваш язык в профиле и в cookie на устройстве, а также пол ребёнка, если вы его указали. Об этом сказано в политике конфиденциальности.",
      ],
      he: [
        "Keepup מדבר עכשיו גם רוסית ועברית. השפה נלקחת מהטלפון; אפשר לשנות אותה בכל זמן ב„פרופיל ← הגדרות ← שפה”. העברית מוצגת מימין לשמאל.",
        "הרגלים שנוספו מההצעות של Keepup מוצגים בשפה שלכם. שמות שכתבתם בעצמכם נשארים כפי שכתבתם.",
        "לילדים אפשר לציין בן או בת (לא חובה), כדי שברוסית ובעברית יגידו להם „כל הכבוד” בצורה הנכונה.",
        "פרטיות: Keepup שומר את השפה שלכם בפרופיל ובעוגייה במכשיר, וגם בן או בת של ילד אם ציינתם. מדיניות הפרטיות מפרטת זאת.",
      ],
    },
  },
  {
    version: "1.4.0",
    date: "2026-10-14",
    notes: [
      "Keepup emails (confirm your address, reset your password, change your email) now look like Keepup, say which account they are about, and tell you what to do if you didn't ask for them.",
      "Privacy: when someone signs up or starts the demo, we get an email alert with their email address (or demo ID), IP address and the country and city it points to, kept for up to 90 days. The privacy policy says so.",
      "Invite links are now always hidden from our error and speed reports.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-12",
    notes: [
      "Just looking? Try the demo is now also on the sign-in and sign-up screens.",
      "Privacy: when you sign up, sign in or start the demo, Keepup now also records your IP address and the country and city it points to, to see where new people come from. The privacy policy says so.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-08",
    notes: [
      "In the kid view, a big empty circle shows where to tap, and the dots for twice-a-day habits are easier to see.",
      "Once you approve or decline a check-in, its Inbox line shows what you decided and stops counting as new.",
      "Export my data now includes the family habits you take part in.",
      "Forgot password? and Delete account are smoother, and the demo shows its recaps.",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-10-08",
    notes: ["A Keepup link shared in a chat or on LinkedIn now shows Keepup's own address in its preview."],
  },
  {
    version: "1.1.0",
    date: "2026-10-08",
    notes: [
      "Keepup has its own address: keepuphabits.vercel.app. Opening the old one brings you here, with a note on how to add Keepup to your Home Screen again.",
      "New: How to install, with step-by-step pictures for iPhone, Android and computer. Find it under Profile, at the bottom.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-08",
    notes: [
      "Keepup has its own address: keepuphabits.vercel.app. Curious friends can try the demo without signing up; it's cleared after 24 hours.",
      "Settings → Export my data saves a copy of your data, and Delete account removes your account and your data.",
      "Forgot your password? Reset it by email from the sign-in page. New email sign-ups get a short message to confirm the address.",
      "Any habit can now be archived, even one you never checked in on.",
      "A privacy policy says plainly what Keepup keeps and for how long, including the error and speed reports that help keep the app working.",
    ],
  },
  {
    version: "0.6.1",
    date: "2026-10-07",
    notes: [
      "Settings → Reset my data: start fresh with your own habits, XP and badges. Your family's shared habits and your kids stay as they are.",
      "Undo is more reliable on a slow or flaky connection, also with Keepup open in more than one tab.",
      "Progress → Active no longer lists habits that have reached their end; you'll find them under Finished.",
      "A check-in saved offline yesterday now counts for yesterday, not today.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-10-06",
    notes: [
      "Every check-in earns XP, and you grow from Seedling to Forest. A ring around your Profile avatar shows the way to the next level, and streak milestones arrive in your Inbox.",
      "24 badges to collect under Profile → Achievements, from First step to Bookworm. Your past check-ins already count.",
      "Rest days: keep a daily habit going for a week and you earn one. Miss a day and it's used for you, so your streak stays safe.",
      "A weekly and monthly recap of your wins, in your Inbox and under Progress → Recaps.",
      "Level-ups and badges get a short celebration (Settings → Celebrations → Subtle for a quieter one). In the kid view, every star now gets a big reveal.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-10-04",
    notes: [
      "Keepup is now an app: add it to your Home Screen and it opens full screen with the sprout icon.",
      "Reminders: one daily summary at the hour you choose, or a habit's own time with “Remind me at…”. For each kind, pick Sound, Silent or Inbox only.",
      "Your group's check-ins, approvals and nudges now reach your phone, and you choose which ones.",
      "No signal? Check in anyway. It's saved on your phone and counts for the day you tapped, once you're back online.",
      "In the kid view, the picture stays in sight and moves gently.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-10-01",
    notes: [
      "Keep habits together: make a group for your family or friends, invite them with a link, and share habits you all check in on.",
      "Add your kids, no account needed. They tap their own habits, earn stars, grow a garden (or an aquarium, space, dino or town), and save up for treats you choose together.",
      "A new Inbox for cheers, gentle nudges and check-ins waiting for your OK.",
      "Give a habit an end, like 30 days, and see “Day 12 of 30” as you go. At the end, keep going or call it finished.",
      "See your progress on a calendar, month by month, and tap any day to see what you did. Plus: sign up with email and a password, and pick an avatar for you and your group.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-29",
    notes: [
      "Add habits from ready-made ideas or make your own, each with its own emoji.",
      "Check in from Today: what's left comes first, then what's done.",
      "Pause a habit when life gets busy, without losing your streak.",
      "Every habit has its own page with its history, streaks and settings.",
      "Progress shows how your week is going, and you can choose whether weeks start on Sunday or Monday.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-29",
    notes: ["A calmer sign-in page, with a proper Google button.", "Sign out now lives on your Profile."],
  },
  {
    version: "0.1.0",
    date: "2026-09-28",
    notes: ["Keepup's first version: sign in, tell us a little about you, and set your time zone."],
  },
];
