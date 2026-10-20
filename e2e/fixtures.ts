import { test as base, type Page } from "@playwright/test";

export * from "@playwright/test";

// Pages stream behind loading screens (app/**/loading.tsx). On a full load (goto, reload) the
// server sends the skeleton, then the page's content in a hidden <div id="S:…"> at the end of
// <body>, and React moves it into place a moment after the load event. Until then a page-wide
// lookup sees a hidden copy, or two copies, and strict mode fails at once. So every goto and
// reload, on every page of every context, waits until React has moved all of them in.
const STREAMED = 'div[hidden][id^="S:"]';
const settled = (page: Page) =>
  page.waitForFunction((sel) => !document.querySelector(sel), STREAMED, { timeout: 10_000 }).catch(() => {});

let patched = false;
export const test = base.extend<object, { streamedPagesSettle: void }>({
  streamedPagesSettle: [
    async ({ browser }, use) => {
      if (!patched) {
        const context = await browser.newContext();
        const proto = Object.getPrototypeOf(await context.newPage()) as Page;
        await context.close();
        const { goto, reload } = proto;
        proto.goto = async function (this: Page, ...args: Parameters<Page["goto"]>) {
          const res = await goto.apply(this, args);
          await settled(this);
          return res;
        };
        proto.reload = async function (this: Page, ...args: Parameters<Page["reload"]>) {
          const res = await reload.apply(this, args);
          await settled(this);
          return res;
        };
        patched = true;
      }
      await use();
    },
    { scope: "worker", auto: true },
  ],
});
