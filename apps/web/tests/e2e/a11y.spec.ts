import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signUpThroughUi } from "./helpers";

const PUBLIC = ["/", "/discover", "/communities", "/c/policy-lab", "/u/demo_hannah", "/how-it-works", "/guidelines", "/signin", "/signup", "/contact"];

for (const path of PUBLIC) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}

test("no serious accessibility violations on signed-in screens", async ({ browser }) => {
  const me = await signUpThroughUi(browser, "Ada");
  for (const path of ["/home", "/challenge", "/activity", "/activity?tab=challenges", "/settings", `/u/${me.username}`]) {
    await me.page.goto(path);
    await me.page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page: me.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  }
  await me.ctx.close();
});
