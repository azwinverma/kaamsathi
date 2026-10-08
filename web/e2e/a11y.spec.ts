import { test } from "@playwright/test";
import { PHONES, expectNoSeriousA11yViolations, loginAs } from "./helpers";

/** axe (WCAG 2 A/AA): fail on serious or critical violations only. */
test("a11y: landing", async ({ page }) => {
  await page.goto("/");
  await expectNoSeriousA11yViolations(page, "landing /");
});

test("a11y: login", async ({ page }) => {
  await page.goto("/login");
  await expectNoSeriousA11yViolations(page, "/login");
});

test("a11y: employer dashboard", async ({ page }) => {
  await loginAs(page, PHONES.employer);
  await expectNoSeriousA11yViolations(page, "/app dashboard");
});

test("a11y: public passport", async ({ page }) => {
  await page.goto("/p/ramthapa83");
  await expectNoSeriousA11yViolations(page, "/p/ramthapa83");
});
