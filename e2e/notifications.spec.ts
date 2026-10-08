import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test("Settings: the daily reminder is back with its hint, and the choices stick", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Notifications" });
  await section.getByRole("button", { name: "What is this?" }).click();
  await expect(section.getByText("When your daily summary arrives, once reminders are on.")).toBeVisible();

  await section.getByLabel("Daily reminder").selectOption("7");
  const nudges = section.getByRole("group", { name: "Nudges" });
  await expect(nudges.getByRole("radio", { name: "Silent" })).toBeChecked(); // the default: no sound, no vibration
  await nudges.getByRole("radio", { name: "Inbox only" }).check();
  await expect(nudges.getByRole("radio", { name: "Inbox only" })).toBeChecked();
  await expect(nudges).not.toHaveAttribute("aria-busy"); // the delivery save (400 ms after the change) has answered
  await page.waitForLoadState("networkidle"); // and the reminder hour's
  await page.reload();
  await expect(section.getByLabel("Daily reminder")).toHaveValue("7");
  await expect(nudges.getByRole("radio", { name: "Inbox only" })).toBeChecked();
  await expect(section.getByText(/On iPhone and iPad, sound is one switch/)).toHaveCount(0);

  await section.getByRole("group", { name: "Approvals" }).getByRole("radio", { name: "Inbox only" }).check();
  await expect(section.getByText("Approvals still wait in your Inbox.")).toBeVisible();
});

test("Settings: arrow keys move through a delivery group, keep focus, and save where they stop", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  const group = page.getByRole("region", { name: "Notifications" }).getByRole("group", { name: "Reminders" });
  await group.getByRole("radio", { name: "Sound" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const third = group.getByRole("radio", { name: "Inbox only" });
  await expect(third).toBeFocused();
  await expect(third).toBeChecked();
  const cue = page.getByTestId("delivery-reminders-saving");
  await expect(cue).toBeVisible(); // a visible "Saving…" while the change waits and saves
  await expect(group).not.toHaveAttribute("aria-busy"); // saved
  await expect(cue).toBeHidden();
  await expect(third).toBeFocused(); // the save didn't take focus away
  await page.reload();
  await expect(group.getByRole("radio", { name: "Inbox only" })).toBeChecked();
});

test("Pause all, then resume", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Notifications" });
  await section.getByRole("button", { name: "Until I turn them back on" }).click();
  await expect(section.getByText("Paused until you turn them back on")).toBeVisible();
  await section.getByRole("button", { name: "Resume" }).click();
  await expect(section.getByRole("button", { name: "8 hours" })).toBeVisible();
});

test.describe("on an iPhone", () => {
  test.use({ userAgent: IPHONE });

  test("an iPhone that hasn't installed Keepup sees how to add it", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/profile/settings");
    await page.getByRole("button", { name: "Turn on reminders" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Keepup to your Home Screen" })).toBeVisible();
    await expect(dialog).toContainText("Add to Home Screen");
  });

  test("an iPhone is told sound is one switch in iOS Settings", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/profile/settings");
    await expect(page.getByRole("region", { name: "Notifications" })
      .getByText("On iPhone and iPad, sound is one switch for all of Keepup: Settings → Notifications → Keepup → Sounds.")).toBeVisible();
  });
});

test("the renewed-subscription route refuses signed-out visitors and other sites", async ({ request }) => {
  const data = { endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${Date.now()}`, p256dh: "p", auth: "a" };
  expect((await request.post("/api/push-subscription", { data, maxRedirects: 0 })).status()).toBe(401);
  expect((await request.post("/api/push-subscription", { data, headers: { Origin: "https://evil.example" } })).status()).toBe(403);
});

test.describe("with push stood in for", () => {
  // Headless Chromium can't subscribe to push: a stand-in PushManager keeps the subscription in
  // localStorage, so it survives a reload. The worker and everything after it are real.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const KEY = "e2e-push-endpoint";
      const make = (endpoint: string) => ({
        endpoint,
        options: {},
        toJSON: () => ({ endpoint, keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" } }),
        unsubscribe: async () => (localStorage.removeItem(KEY), true),
      });
      PushManager.prototype.getSubscription = async function () {
        const e = localStorage.getItem(KEY);
        return (e ? make(e) : null) as unknown as PushSubscription;
      };
      PushManager.prototype.subscribe = async function () {
        const e = `https://fcm.googleapis.com/fcm/send/e2e-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(KEY, e);
        return make(e) as unknown as PushSubscription;
      };
      Notification.requestPermission = async () => "granted";
      Object.defineProperty(Notification, "permission", { get: () => "granted" });
    });
  });

  test("turn on reminders: the hour, allow, this device is on; Remove keeps it removed", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/profile/settings");
    const section = page.getByRole("region", { name: "Notifications" });
    await section.getByRole("button", { name: "Turn on reminders" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Daily summary at").selectOption("7");
    await dialog.getByRole("button", { name: "Allow notifications" }).click();

    const on = section.getByText("Reminders are on for this device ✓ Your daily summary arrives at 07:00.");
    await expect(on).toBeVisible();
    await expect(on).toBeFocused();
    await expect(section.getByLabel("Daily reminder")).toHaveValue("7");
    await expect(section.getByText("Android · Chrome · this device")).toBeVisible();

    await section.getByRole("button", { name: "Remove Android · Chrome (this device)" }).click();
    await expect(section.getByRole("button", { name: "Turn on reminders" })).toBeVisible();
    await page.reload();
    await expect(section.getByRole("button", { name: "Turn on reminders" })).toBeVisible();
    await expect(section.getByRole("heading", { name: "Devices" })).toHaveCount(0);
  });

  test("this device's reminder line follows Pause all and Inbox only", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/profile/settings");
    const section = page.getByRole("region", { name: "Notifications" });
    await section.getByRole("button", { name: "Turn on reminders" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Allow notifications" }).click();
    await expect(section.getByText(/^Reminders are on for this device ✓/)).toBeVisible();

    await section.getByRole("button", { name: "Until I turn them back on" }).click();
    await expect(section.getByText("Reminders are paused until you turn them back on.")).toBeVisible();
    await section.getByRole("button", { name: "Resume" }).click();
    await expect(section.getByText(/^Reminders are on for this device ✓/)).toBeVisible();

    await section.getByRole("group", { name: "Reminders" }).getByRole("radio", { name: "Inbox only" }).check();
    await expect(section.getByText("Reminders go to your Inbox.")).toBeVisible();
  });

  test("the re-save on open never saves a device this account doesn't have", async ({ page }) => {
    await signUpAndOnboard(page);
    const res = await page.request.post("/api/push-subscription", {
      data: { endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${Date.now()}`, p256dh: "p", auth: "a", refresh: true },
    });
    expect(res.status()).toBe(204);
    await page.goto("/profile/settings");
    await expect(page.getByRole("region", { name: "Notifications" }).getByRole("button", { name: "Turn on reminders" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Devices" })).toHaveCount(0);
  });
});

test("Remind me at… moves a habit out of the summary to its own time, and Mute sticks", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Vitamins", count: 1, period: "day" });
  await page.getByRole("link", { name: /Vitamins/ }).click();
  const row = page.getByRole("group", { name: "Reminders" });
  await page.getByText("Reminders", { exact: true }).click();
  await expect(page.getByText("In your daily summary at 20:00")).toBeVisible();

  await row.getByRole("radio", { name: "At a time" }).check();
  await row.getByLabel("Reminder time").selectOption("08:00");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByRole("status")).toHaveText("Saved ✓");
  await row.getByRole("checkbox", { name: /Mute this habit/ }).check();
  await expect(row.getByRole("status")).toHaveText("Saved ✓");

  await page.reload();
  await expect(page.getByText("Muted: no reminders for this habit", { exact: true })).toBeVisible();
  await page.getByText("Reminders", { exact: true }).click();
  await expect(row.getByRole("radio", { name: "At a time" })).toBeChecked();
  await expect(row.getByLabel("Reminder time")).toHaveValue("08:00");
  // The VAPID key comes from scripts/local-env.mjs (CI runs it); without a key the button is not rendered.
  await expect(row.getByRole("button", { name: "Turn on reminders on this device" })).toBeVisible();
});
