import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

test("the Today card counts today's habits, cheers you on, and celebrates the last one", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await createHabit(page, { title: "Read", count: 1, period: "day" });
  await createHabit(page, { title: "Stretch", count: 1, period: "day" });

  const card = page.getByRole("region", { name: "Today's progress" });
  await expect(card).toContainText("0 of 3 done");
  await expect(card.getByRole("status")).toHaveText("3 to go today");
  await expect(card.getByRole("img", { name: "0 of 3 done today" })).toBeVisible();
  const row = card.getByRole("img", { name: /^Today's habits:/ });
  await expect(row).toHaveAccessibleName("Today's habits: Walk to do, Read to do, Stretch to do");

  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(row).toHaveAccessibleName("Today's habits: Walk done, Read to do, Stretch to do");
  await expect(card.getByRole("status")).toHaveText("2 to go");

  await page.getByRole("button", { name: "Check in: Read" }).click();
  await expect(card.getByRole("status")).toHaveText("One more to go!");

  await page.getByRole("button", { name: "Check in: Stretch" }).click();
  await expect(card.getByRole("status")).toHaveText("Today's all done 🎉");
  await expect(card).toContainText("3 of 3 done");
});
