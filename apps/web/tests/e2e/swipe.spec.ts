import { expect, test } from "@playwright/test";
import { signUpThroughUi } from "./helpers";

test("swipe-to-challenge deck: skip with the keyboard, challenge with a swipe", async ({ browser }) => {
  const me = await signUpThroughUi(browser, "Sam");
  const page = me.page;
  await page.goto("/challenge");
  const deck = page.locator("article").first();
  await expect(deck).toBeVisible();
  const first = await deck.getAttribute("aria-label");
  await page.keyboard.press("ArrowLeft"); // skip
  await expect(page.locator("article").first()).not.toHaveAttribute("aria-label", first!);
  // drag the next card right past the threshold
  const box = (await page.locator("article").first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "Send a challenge" })).toBeVisible();
  await expect(page.getByLabel("Proposition")).toBeVisible();
  await me.ctx.close();
});
