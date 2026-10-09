import { expect, test } from "@playwright/test";

/** Public pages at phone width: no horizontal scroll and the primary actions are reachable. */
for (const path of ["/", "/discover", "/communities", "/c/policy-lab", "/u/demo_hannah", "/how-it-works", "/signup"]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("landing offers the three primary actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Explore debates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a FaceOff" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create your Wall" }).first()).toBeVisible();
});
