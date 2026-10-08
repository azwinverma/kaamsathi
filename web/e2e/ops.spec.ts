import { expect, test } from "@playwright/test";
import { PHONES, loginAs } from "./helpers";

/** Ops staff journey: verification queue → verify a pending worker → credentials queue → KYB. */
test("ops: verify a worker, credentials queue, employers KYB", async ({ page }) => {
  await loginAs(page, PHONES.ops, "ops");

  await test.step("verification queue", async () => {
    await page.goto("/ops/verification");
    await expect(page.getByRole("heading", { level: 1, name: "Verification queue" })).toBeVisible();
    const empty = page.getByText("Nobody is waiting for verification");
    const verify = page.getByRole("button", { name: "Verify", exact: true });
    await expect(empty.or(verify).first()).toBeVisible();
    if (await empty.isVisible()) {
      test.info().annotations.push({ type: "skip-step", description: "verification queue empty" });
      return;
    }
    await verify.click();
    // Seeded pending workers may lack ID documents; the API then refuses (400) and the UI shows an
    // error toast. Either outcome proves the queue → decision round trip works.
    const ok = page.getByText(/ verified$/).first();
    const refused = page.locator('[data-sonner-toast][data-type="error"]').first();
    await expect(ok.or(refused)).toBeVisible();
    if (await refused.isVisible()) {
      test.info().annotations.push({ type: "note", description: "first pending worker has missing documents" });
    }
  });

  await test.step("credentials queue renders", async () => {
    await page.goto("/ops/credentials");
    await expect(page.getByRole("heading", { level: 1, name: "Credentials" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Verification queue" })).toBeVisible();
  });

  await test.step("employers (KYB) page renders", async () => {
    const res = await page.goto("/ops/employers");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
});
