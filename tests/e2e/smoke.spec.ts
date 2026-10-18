import { expect, test } from "@playwright/test";

test("unauthenticated visitors land on the sign-in page", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /plan\.\s*review\./i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("manifest and service worker are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).name).toBe("Life OS");
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBeTruthy();
});

test("offline page renders", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByText("No connection")).toBeVisible();
});

test("cron endpoint requires the bearer secret", async ({ request }) => {
  const denied = await request.get("/api/cron/heartbeat");
  expect(denied.status()).toBe(401);
  const unknown = await request.get("/api/cron/nope", { headers: { authorization: "Bearer e2e-cron-secret" } });
  expect(unknown.status()).toBe(404);
  const ok = await request.get("/api/cron/heartbeat", { headers: { authorization: "Bearer e2e-cron-secret" } });
  expect(ok.ok()).toBeTruthy();
  expect((await ok.json()).job).toBe("heartbeat");
});

test("sign-in offers a code field after the email step", async ({ page }) => {
  await page.goto("/login?sent=1");
  await expect(page.getByLabel("Code")).toBeVisible();
  await page.getByLabel("Code").fill("12ab");
  // The browser blocks a malformed code before any request is made.
  expect(await page.getByLabel("Code").evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(true);
});

test("a code without a pending email asks to start over", async ({ page }) => {
  await page.goto("/login?sent=1");
  await page.getByLabel("Code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("sign-in request expired")).toBeVisible();
});
