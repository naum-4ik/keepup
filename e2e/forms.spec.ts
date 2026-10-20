import { expect, test } from "./fixtures";
import { signUpAndOnboard, TEST_PASSWORD } from "./helpers/auth";
import { createGroup } from "./helpers/groups";

// The forms rule (docs/design.md "States and feedback"): a refused field shows the app's message
// beside it, is marked invalid and described by that message, and takes focus. No browser bubbles:
// the forms are noValidate, so the server's words are what the person sees.

test("sign-up with a bad email: the message under the email, marked, and focused", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.locator("form").filter({ has: page.getByLabel("Email") })).toHaveAttribute("novalidate", "");
  const email = page.getByLabel("Email");
  await email.fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.locator("#signup-error")).toHaveText("Enter a valid email address.");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "signup-error");
  await expect(email).toBeFocused();
  await expect(page.getByLabel("Password", { exact: true })).not.toHaveAttribute("aria-invalid", "true");
});

test("new habit with no title and add a child with no name: the message beside the field, which takes focus", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  await page.getByRole("button", { name: "Add habit" }).click();
  const title = page.getByLabel("Title");
  await expect(page.locator("#title-error")).toHaveText("Enter a title.");
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAttribute("aria-describedby", "title-error");
  await expect(title).toBeFocused();

  await createGroup(page, "Fam");
  const groupId = page.url().match(/\/groups\/([0-9a-f-]{36})/)![1];
  await page.goto(`/kids/new?group=${groupId}`);
  await page.getByLabel("I'm this child's parent or guardian").check();
  await page.getByRole("button", { name: "Add child" }).click();
  const nickname = page.getByLabel("Nickname");
  await expect(page.locator("#child-name-error")).toHaveText("Enter a nickname.");
  await expect(nickname).toHaveAttribute("aria-invalid", "true");
  await expect(nickname).toHaveAttribute("aria-describedby", "child-name-error child-name-help");
  await expect(nickname).toBeFocused();
  // A field's message, not the form's: no Notice above the button.
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
