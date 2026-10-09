import { expect, test, type Page } from "@playwright/test";
import { OTP_CODE, expectNoSeriousA11yViolations } from "./helpers";

/**
 * Bolau (docs/CONTRACT-BOLAU.md) on the seeded demo data (apps/bolau/demo.py: flag `bolau` ON,
 * verified Sipalu `suman-electric`, Ghardhani Sita 9800000020). Skips with a reason when the API
 * has no Bolau (flag off / older backend), because every public Bolau page 404s then.
 */
const GHARDHANI = "9800000020";
const SIPALU = "suman-electric";

async function bolauAvailable(page: Page): Promise<boolean> {
  const res = await page.request.get("/bolau");
  return res.status() === 200;
}

test.describe("bolau", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await bolauAvailable(page)), "Bolau API not available (flag `bolau` off or backend without apps.bolau)");
  });

  test("a11y: /bolau and a public Sipalu profile", async ({ page }) => {
    await page.goto("/bolau");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "/bolau");
    await page.goto(`/sipalu/${SIPALU}`);
    await expect(page.getByRole("heading", { level: 1, name: "Suman Maharjan" })).toBeVisible();
    await expectNoSeriousA11yViolations(page, `/sipalu/${SIPALU}`);
  });

  test("search → profile → book as a Ghardhani → booking shows in /ghar", async ({ page }) => {
    // Sita prefers Nepali; pin English so the OTP login doesn't switch the UI language mid-test.
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: new URL(page.url() === "about:blank" ? (process.env.BASE_URL || "http://localhost:3000") : page.url()).origin }]);
    await test.step("search electricians", async () => {
      await page.goto("/bolau");
      await page.getByRole("search").getByText("Electrician", { exact: true }).click();
      await expect(page).toHaveURL(/trade=electrician/);
      await expect(page.getByRole("link", { name: "Suman Maharjan" })).toBeVisible();
    });

    await test.step("open the profile and start booking", async () => {
      await page.getByRole("link", { name: "Suman Maharjan" }).click();
      await expect(page).toHaveURL(new RegExp(`/sipalu/${SIPALU}$`));
      await expect(page.getByRole("heading", { level: 2, name: "Services and prices" })).toBeVisible();
      await page.getByRole("link", { name: /^Bolau Suman/ }).first().click();
      await expect(page).toHaveURL(new RegExp(`/bolau/book/${SIPALU}`));
    });

    await test.step("service and description", async () => {
      await expect(page.getByRole("heading", { name: /What do you need Suman to do\?/ })).toBeVisible();
      await page.getByLabel(/Describe the job/).fill("E2E: bedroom ceiling fan hums but does not spin.");
      await page.getByRole("button", { name: "Continue" }).click();
    });

    const pickSlot = async (offset: number) => {
      await expect(page.getByRole("heading", { name: /When should Suman come\?/ })).toBeVisible();
      // Chips are labels wrapping visually-hidden radios: click the label.
      const days = page.getByRole("group", { name: "Day" }).locator("label");
      const n = await days.count();
      await days.nth(Math.max(0, n - 1 - (offset % n))).click();
      const slots = page.getByRole("group", { name: "Start time" }).locator("label");
      const m = await slots.count();
      const slot = slots.nth(Math.max(0, m - 1 - Math.floor(offset / n)));
      await slot.click();
      await expect(slot.getByRole("radio")).toBeChecked();
      await page.getByRole("button", { name: "Continue" }).click();
    };

    await test.step("pick a day and time", async () => {
      await pickSlot(0);
    });

    await test.step("log in inline with OTP", async () => {
      await expect(page.getByRole("heading", { name: "Log in with your phone to book" })).toBeVisible();
      await page.getByLabel("Mobile number").fill(GHARDHANI);
      await page.getByRole("button", { name: "Send code" }).click();
      await page.getByRole("textbox", { name: "Digit 1 of 6" }).fill(OTP_CODE);
      const legal = page.getByRole("button", { name: "Accept and continue" });
      const ready = page.getByText(/address and phone are shared with Suman only after they accept/);
      await expect(legal.or(ready)).toBeVisible({ timeout: 30_000 });
      if (await legal.isVisible()) {
        const boxes = page.getByRole("checkbox", { name: /^I have read and accept/ });
        for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).click();
        await legal.click();
      }
      await expect(ready).toBeVisible();
    });

    await test.step("address (saved, else a new one)", async () => {
      const saved = page.getByRole("group", { name: "Saved addresses" });
      await expect(saved.or(page.getByLabel("House, street or tole"))).toBeVisible();
      if (!(await saved.isVisible())) {
        await page.getByLabel("House, street or tole").fill("House 14, Baneshwor Marg");
        await page.getByLabel("Ward").fill("10");
        await page.getByLabel("Municipality").fill("Kathmandu Metropolitan City");
        await page.getByLabel("District").selectOption("kathmandu");
        await page.getByRole("button", { name: "Save address" }).click();
      }
      await page.getByRole("button", { name: "Continue" }).click();
    });

    await test.step("review the price + fee line and confirm", async () => {
      await expect(page.getByRole("heading", { name: "Check before you confirm" })).toBeVisible();
      await expect(page.getByText(/KaamSathi's booking fee: (waived|Rs\. )/)).toBeVisible();
      await expect(page.getByText(/Pay the Sipalu directly/)).toBeVisible();
      for (let attempt = 1; attempt <= 6; attempt++) {
        await page.getByRole("button", { name: /^(Confirm booking|Send booking)$/ }).click();
        const done = page.getByRole("heading", { name: "Booking sent" });
        const taken = page.getByText("That time was just taken. Please pick another.");
        await expect(done.or(taken)).toBeVisible();
        if (await done.isVisible()) break;
        await pickSlot(attempt);
        await page.getByRole("button", { name: "Continue" }).click(); // address step
      }
      await expect(page.getByRole("heading", { name: "Booking sent" })).toBeVisible();
    });

    await test.step("the booking appears in /ghar", async () => {
      const code = (await page.getByText(/^Booking BK-/).textContent())?.replace("Booking ", "").trim() ?? "";
      expect(code).toMatch(/^BK-/);
      await page.getByRole("link", { name: "Open my booking" }).click();
      await expect(page).toHaveURL(/\/ghar\/bookings\/[0-9a-f-]+$/);
      await expect(page.getByRole("heading", { name: "Booking progress" })).toBeVisible();
      await expect(page.getByText("In an emergency, call Nepal Police on 100.").first()).toBeVisible();
      await page.goto("/ghar");
      await expect(page.getByRole("heading", { level: 1, name: "My bookings" })).toBeVisible();
      await page.getByRole("tab", { name: "All" }).click();
      await expect(page.getByText(code)).toBeVisible();
    });
  });
});
