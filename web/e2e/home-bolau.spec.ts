import { expect, test } from "@playwright/test";
import { bolauAvailable, expectNoSeriousA11yViolations, pinEnglish } from "./helpers";

/**
 * Home page with the `bolau` flag on (docs/CONTRACT-BOLAU.md): the Bolau hero leads, its search
 * lands on /bolau with the chosen params and real results, and the page is axe-clean. Read-only
 * (no bookings are made). Skips while the flag is off — the employer-first home is covered by
 * a11y.spec.ts and the unit tests in app/page.test.tsx.
 */
test.describe("home · Bolau leads", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await bolauAvailable(page)), "Bolau API not available (flag `bolau` off or backend without apps.bolau)");
    await pinEnglish(page);
  });

  test("hero, header CTA, Sipalu near you; axe clean", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Book verified Sipalu in Kathmandu Valley/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/verified Sipalu at your door/);
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Bolau a Sipalu" })).toHaveAttribute("href", "/bolau");
    await expect(header.getByRole("link", { name: "Hire verified workers" })).toBeHidden();
    await expect(page.getByRole("search", { name: "Bolau a Sipalu" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Sipalu near you" })).toBeVisible();
    // Real cards from /bolau/search (the API's ranking decides who shows), each linking to a profile.
    const cards = page.locator("#sipalu-near a[href^='/sipalu/']");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
    expect(await cards.count()).toBeLessThanOrEqual(6);
    await expect(page.getByRole("heading", { level: 2, name: /Hiring for a hotel/ })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "home / (bolau on)");
  });

  test("hero search → /bolau with trade, day and results", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("search", { name: "Bolau a Sipalu" });
    await search.getByText("Electrician", { exact: true }).click();
    // Picking a chip doesn't navigate on the home page; only the Bolau button does.
    await expect(page).toHaveURL(/\/$/);
    const day = search.getByLabel("When?");
    const tomorrow = await day.locator("option").nth(2).getAttribute("value");
    await day.selectOption(tomorrow!);
    await search.getByRole("button", { name: "Bolau" }).click();
    await expect(page).toHaveURL(/\/bolau\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("trade")).toBe("electrician");
    expect(url.searchParams.get("date")).toBe(tomorrow);
    await expect(page.getByRole("heading", { level: 2, name: "Sipalu you can book" })).toBeVisible();
    // Demo electricians (e.g. Suman Maharjan) work most days; any real result row will do.
    await expect(page.locator("#results a[href^='/sipalu/']").first()).toBeVisible();
    // The same hero on /bolau, with the trade still picked.
    await expect(page.getByRole("search").getByRole("radio", { name: "Electrician" })).toBeChecked();
  });
});
