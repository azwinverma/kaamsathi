import { expect, test, type BrowserContext } from "@playwright/test";
import { bolauAvailable, expectNoSeriousA11yViolations, inlineOtpLogin, pinEnglish } from "./helpers";

/**
 * Bolau (docs/CONTRACT-BOLAU.md) on the seeded demo data (apps/bolau/demo.py: flag `bolau` ON,
 * verified Sipalu `suman-electric` who takes instant bookings, Ghardhani Sita 9800000020). Skips
 * with a reason when the API has no Bolau (flag off / older backend): every public page 404s then.
 *
 * Cleans up after itself: the booking it creates (description "E2E: …") is cancelled by the
 * /ghar detail test, or by `afterAll` through the API if a step failed before that.
 */
const GHARDHANI = "9800000020";
const SIPALU = "suman-electric";

type Created = { id: string; url: string; cookies: Awaited<ReturnType<BrowserContext["cookies"]>>; cancelled: boolean };
let created: Created | null = null;

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ browser }) => {
  if (!created || created.cancelled) return;
  const ctx = await browser.newContext();
  await ctx.addCookies(created.cookies);
  const base = process.env.BASE_URL || "http://localhost:3000";
  const res = await ctx.request.post(`${base}/api/proxy/bolau/bookings/${created.id}/cancel`, {
    data: { reason: "E2E: cleanup" },
    headers: { origin: new URL(base).origin },
  });
  // 400 invalid_state = already finished/cancelled elsewhere; anything else is worth a look.
  expect([200, 400]).toContain(res.status());
  await ctx.close();
});

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
    await pinEnglish(page);
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
      await inlineOtpLogin(page, GHARDHANI, page.getByText(/address and phone are shared with Suman only after they accept/));
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
      // Fee line + free-cancel copy come from GET /bolau/config (no hard-coded amounts).
      await expect(page.getByText(/KaamSathi's booking fee: (waived|Rs\. \d+)/)).toBeVisible();
      await expect(page.getByText(/Free cancellation until \d+ hours before the start/)).toBeVisible();
      await expect(page.getByText(/Pay the Sipalu directly/)).toBeVisible();
      // A slot can be taken by someone else meanwhile: walk back through other days/slots.
      for (let attempt = 1; attempt <= 12; attempt++) {
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
      const url = new URL(page.url()).pathname;
      created = { id: url.split("/").pop() as string, url, cookies: await page.context().cookies(), cancelled: false };
      await expect(page.getByRole("heading", { name: "Booking progress" })).toBeVisible();
      await expect(page.getByText("In an emergency, call Nepal Police on 100.").first()).toBeVisible();
      await page.goto("/ghar");
      await expect(page.getByRole("heading", { level: 1, name: "My bookings" })).toBeVisible();
      await page.getByRole("tab", { name: "All" }).click();
      await expect(page.getByText(code)).toBeVisible();
    });
  });

  test("/ghar booking detail: arrival code, free-cancel window, cancel (axe)", async ({ page }) => {
    test.skip(!created, "needs the booking made by the previous test");
    const booking = created as Created;
    await page.context().addCookies(booking.cookies);
    await page.goto(booking.url);
    await expect(page.getByRole("heading", { name: "Booking progress" })).toBeVisible();

    await test.step("instant booking → accepted → the arrival code is shown", async () => {
      await expect(page.getByRole("heading", { name: "Your arrival code" })).toBeVisible();
      await expect(page.getByText(/^Arrival code \d \d \d \d$/)).toBeAttached();
      await expect(page.getByText(/^KaamSathi's booking fee: /)).toBeVisible();
    });

    await test.step("free-cancel window is stated", async () => {
      await expect(page.getByTestId("free-cancel-note")).toHaveText(/^Free to cancel until /);
    });

    await expectNoSeriousA11yViolations(page, "/ghar/bookings/[id]");

    await test.step("cancel inside the free window", async () => {
      await page.getByRole("button", { name: "Cancel booking" }).click();
      const dialog = page.getByRole("dialog", { name: "Cancel this booking?" });
      await expect(dialog.getByText(/^Free to cancel until /)).toBeVisible();
      await dialog.getByLabel("Reason").fill("E2E: cleanup — plans changed");
      await dialog.getByRole("button", { name: "Cancel booking" }).click();
      await expect(dialog).toBeHidden();
      booking.cancelled = true;
      await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your arrival code" })).toBeHidden();
      await expect(page.getByRole("button", { name: "Cancel booking" })).toBeHidden();
    });

    await test.step("a disputed demo booking shows the dispute with evidence (read-only)", async () => {
      const list = await (await page.request.get("/api/proxy/me/booking-disputes")).json();
      const d = list.results?.find((x: { booking?: { id: string } | null; status: string }) => x.booking && x.status === "open");
      if (!d) {
        test.info().annotations.push({ type: "note", description: "no open demo booking dispute for Sita" });
        return;
      }
      await page.goto(`/ghar/bookings/${d.booking.id}`);
      const box = page.getByRole("region", { name: "Dispute" });
      await expect(box).toBeVisible();
      await expect(box.getByText(/Asked for Rs 500 more/)).toBeVisible();
      await expect(box.getByText(/^\[BK-/)).toHaveCount(0); // stored prefix is hidden
      await expect(box.getByRole("heading", { name: "Evidence" })).toBeVisible();
      await expect(box.getByLabel("File")).toBeVisible();
      await expectNoSeriousA11yViolations(page, "/ghar/bookings/[id] (disputed)");
    });

    await test.step("the API agrees: cancelled by the Ghardhani, not late", async () => {
      const res = await page.request.get(`/api/proxy/bolau/bookings/${booking.id}`);
      expect(res.status()).toBe(200);
      const b = await res.json();
      expect(b.status).toBe("cancelled");
      expect(b.cancelled_by).toBe("ghardhani");
      expect(b.late_cancellation).toBe(false);
    });
  });
});
