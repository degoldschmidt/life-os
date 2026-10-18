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
