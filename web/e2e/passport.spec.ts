import { expect, test } from "@playwright/test";

/** Public Skill Passport (seeded for Ram Bahadur Thapa in backend/apps/credentials/demo.py). */
test("public passport renders", async ({ page }) => {
  const res = await page.goto("/p/ramthapa83");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(/Ram/);
});

test("unknown passport code is a 404", async ({ page }) => {
  const res = await page.goto("/p/does-not-exist-404");
  expect(res?.status()).toBe(404);
});
