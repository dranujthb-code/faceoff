import { expect, test } from "@playwright/test";
import { signUpThroughUi, sql } from "./helpers";

/**
 * The FaceOff loop end to end, with three independent browser sessions:
 * sign up → Wall → challenge → accept → green room consent → live → audience comment/vote →
 * host ends → result on the Wall → share URL. Plus blocking, reporting and admin protection.
 */
test("two debaters and a viewer complete a FaceOff through the UI", async ({ browser }) => {
  const db = sql();
  const alice = await signUpThroughUi(browser, "Alice");
  const bob = await signUpThroughUi(browser, "Bob");
  const viewer = await signUpThroughUi(browser, "Vera");

  // Alice's Wall exists and is public.
  await alice.page.goto(`/u/${alice.username}`);
  await expect(alice.page.getByRole("heading", { name: alice.displayName })).toBeVisible();

  // Alice challenges Bob from his Wall.
  await alice.page.goto(`/u/${bob.username}`);
  await alice.page.getByRole("link", { name: "Send a challenge" }).click();
  await alice.page.getByLabel("Proposition").fill("Public transport should be free");
  await alice.page.getByRole("button", { name: /Right now/ }).click();
  await alice.page.getByRole("button", { name: "Send challenge" }).click();
  await alice.page.waitForURL(/\/activity\?tab=challenges/);
  await expect(alice.page.getByText("Public transport should be free")).toBeVisible();

  // Bob sees the challenge — proposition and his side — and accepts.
  await bob.page.goto("/activity?tab=challenges");
  const card = bob.page.locator("li", { hasText: "Public transport should be free" });
  await expect(card.getByText(/You argue/)).toContainText("against");
  await card.getByRole("button", { name: "Accept" }).click();
  await bob.page.waitForURL(/\/d\//);
  const debateUrl = bob.page.url();
  const debatePath = new URL(debateUrl).pathname;

  // Green room: Bob tests his (fake) camera, consents and gets ready.
  await expect(bob.page.getByRole("heading", { name: "Green room" })).toBeVisible();
  await bob.page.getByRole("button", { name: "Test camera and mic" }).click();
  await expect(bob.page.getByRole("button", { name: "Camera is working" })).toBeVisible();
  await bob.page.getByRole("radio", { name: "I agree to be recorded" }).click();
  await bob.page.getByLabel(/I agree to the debate rules/).check();
  await bob.page.getByRole("button", { name: "I'm ready" }).click();
  await expect(bob.page.getByText(/You're ready\. Waiting for/)).toBeVisible();

  // Alice gets a notification, enters the room and gets ready → the debate goes live.
  await alice.page.goto("/activity");
  await expect(alice.page.getByText(/accepted your challenge/)).toBeVisible();
  await alice.page.goto(debatePath);
  await alice.page.getByLabel(/I agree to the debate rules/).check();
  await alice.page.getByRole("button", { name: "I'm ready" }).click();
  await expect(alice.page.getByRole("timer")).toBeVisible();
  await expect(bob.page.getByRole("timer")).toBeVisible({ timeout: 20_000 });
  const t = await alice.page.getByRole("timer").getAttribute("aria-label");
  expect(t).toMatch(/^(10:00|09:[0-5]\d) remaining$/);

  // The viewer finds it live, comments and votes.
  await viewer.page.goto(debatePath);
  await expect(viewer.page.getByText("Live", { exact: true }).first()).toBeVisible();
  await viewer.page.getByLabel("Write a comment").fill("Bob's point on funding is strong");
  await viewer.page.getByRole("button", { name: "Post" }).click();
  await expect(viewer.page.getByText("Bob's point on funding is strong")).toBeVisible();
  await viewer.page.getByRole("tab", { name: "Vote" }).click();
  await viewer.page.getByRole("button", { name: /^Against/ }).first().click();
  await expect(viewer.page.getByText("(your vote)")).toBeVisible();

  // Debaters see the audience comment arrive.
  await expect(alice.page.getByText("Bob's point on funding is strong")).toBeVisible({ timeout: 15_000 });
  // Debaters can't vote on their own persuasion poll.
  await alice.page.getByRole("tab", { name: "Vote" }).click();
  await expect(alice.page.getByText(/debaters can't vote on this one/)).toBeVisible();

  // The host (Alice) ends early; everyone lands on the result.
  await alice.page.getByRole("button", { name: "End debate early" }).click();
  await alice.page.getByRole("dialog").getByRole("button", { name: "End debate", exact: true }).click();
  await expect(alice.page.getByRole("heading", { name: "Debate complete" })).toBeVisible();
  await expect(viewer.page.getByRole("heading", { name: "Debate complete" })).toBeVisible({ timeout: 40_000 });
  await expect(viewer.page.getByText("The host ended the debate early.")).toBeVisible();
  await expect(viewer.page.getByText(/wasn't recorded|replay is processing/)).toBeVisible();

  // Completed debate appears on both Walls; the public URL works signed out.
  await bob.page.goto(`/u/${bob.username}`);
  await expect(bob.page.getByRole("link", { name: /Public transport should be free/ })).toBeVisible();
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(debatePath);
  await expect(anonPage.getByRole("heading", { name: "Public transport should be free" })).toBeVisible();
  await expect(anonPage.getByRole("link", { name: "Sign in" }).last()).toBeVisible();

  // Reporting: the viewer reports the debate; it appears in the admin queue.
  await viewer.page.goto(debatePath);
  await viewer.page.getByRole("button", { name: "Report this debate" }).click();
  await viewer.page.getByLabel("Spam or scam").check();
  await viewer.page.getByRole("button", { name: "Submit report" }).click();
  await expect(viewer.page.getByText(/Trust & Safety team will review/)).toBeVisible();

  // Admin pages are protected from ordinary users.
  await alice.page.goto("/admin");
  await expect(alice.page).toHaveURL(/\/home/);
  const apiRes = await alice.page.request.get("/api/v1/admin/metrics");
  expect(apiRes.status()).toBe(403);

  // Blocking: Bob blocks the viewer, who can no longer challenge him.
  await bob.page.goto(`/u/${viewer.username}`);
  await bob.page.getByRole("button", { name: "More actions" }).click();
  await bob.page.getByRole("menuitem", { name: "Block" }).click();
  await bob.page.getByRole("button", { name: "Block", exact: true }).click();
  await expect(bob.page.getByText(/^Blocked /)).toBeVisible();
  await viewer.page.goto(`/u/${bob.username}`);
  await expect(viewer.page.getByRole("heading", { name: "Nothing to debate here" })).toBeVisible();

  // An admin sees the report.
  const [r] = await db`select count(*)::int as n from faceoff.reports where target_type = 'session' and target_id = ${debatePath.split("/").pop()!}`;
  expect(r!.n).toBe(1);
  await db.end();
  for (const p of [alice, bob, viewer]) await p.ctx.close();
  await anon.close();
});
