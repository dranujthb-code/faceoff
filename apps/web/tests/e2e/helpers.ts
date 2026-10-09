import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";

export const sql = () => postgres(process.env.DATABASE_ADMIN_URL ?? "postgres://postgres@127.0.0.1:54322/faceoff_dev", { max: 2, onnotice: () => {} });
export const uniq = (p = "e") => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export interface Person { ctx: BrowserContext; page: Page; username: string; email: string; displayName: string }

/** Signs up through the UI, confirms email via the dev mailbox page, and completes onboarding. */
export async function signUpThroughUi(browser: Browser, name: string): Promise<Person> {
  const ip = `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip }, permissions: ["camera", "microphone"] });
  const page = await ctx.newPage();
  const username = uniq(name.toLowerCase()).slice(0, 20);
  const email = `${username}@example.test`;
  const displayName = `${name} ${username.slice(-4)}`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Debate-2026-ok");
  await page.getByLabel("Date of birth").fill("1994-06-15");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);

  // Confirm email from the captured message.
  await page.goto("/dev/mailbox");
  const link = page.locator("li", { hasText: email }).first().getByRole("link").first();
  const href = await link.getAttribute("href");
  await page.goto(href!.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();

  await page.goto("/onboarding");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Politics" }).click();
  await page.getByRole("button", { name: "Technology" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Ballot Box/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/^Bio/).fill(`I'm ${name}, here to argue.`);
  await page.getByRole("button", { name: "Create my Wall" }).click();
  await page.waitForURL(/\/home/);
  return { ctx, page, username, email, displayName };
}
