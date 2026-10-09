import { expect, test, type Page } from "@playwright/test";
import { bolauAvailable, inlineOtpLogin, pinEnglish } from "./helpers";

/**
 * Sipalu onboarding wizard (/sipalu/join) end to end on the web, as a brand-new phone number
 * (98000009xx, dev OTP). Every step is saved through POST /me/sipalu/onboarding-step; the new
 * Sipalu stays `pending` (unverified → never public or bookable), so nothing leaks into search.
 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAUUlEQVR42u3PMQ0AMAgAMJgaJCIRWVPBQdI6aE5XXPbiOAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAYF9HxzAAehaf9vAAAAAAElFTkSuQmCC",
  "base64",
);

const STEP_TITLE = {
  name: "Your name, as on your citizenship",
  photo: "Add a clear photo of your face",
  skills: "What work do you do?",
  languages: "Which languages do you speak?",
  area: "Where do you work?",
  hours: "When can households book you?",
  prices: "What do you charge?",
  about: "Tell households about your work",
  payment: "Where should households pay you?",
  identity: "Identity check",
  consent: "Your consent",
  handle: "Your profile link",
  done: "Your profile is ready for review",
} as const;

const randomPhone = () => `98000009${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;

async function stepHeading(page: Page, key: keyof typeof STEP_TITLE) {
  await expect(page.getByRole("heading", { level: 2, name: STEP_TITLE[key] })).toBeVisible();
}

async function saveAndContinue(page: Page) {
  await page.getByRole("button", { name: "Save and continue" }).click();
}

test.describe("sipalu join", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await bolauAvailable(page)), "Bolau API not available (flag `bolau` off or backend without apps.bolau)");
  });

  test("a new phone completes the Sipalu onboarding wizard", async ({ page }) => {
    test.setTimeout(180_000);
    await pinEnglish(page);
    let phone = "";

    await test.step("log in with a phone that has no Sipalu profile yet", async () => {
      // A random 98000009xx may have been used by an earlier run: then log out and try another.
      for (let attempt = 0; attempt < 6; attempt++) {
        phone = randomPhone();
        await page.goto("/sipalu/join");
        await expect(page.getByRole("heading", { name: "Log in with your phone" })).toBeVisible();
        await inlineOtpLogin(page, phone, page.getByRole("navigation", { name: "Profile steps" }));
        const me = await (await page.request.get("/api/proxy/me/sipalu")).json();
        if (!me.name && !me.completed_steps?.includes("name")) return; // fresh account (a handle is auto-assigned)
        await page.request.post("/api/auth/logout", { data: {} });
        await page.context().clearCookies({ name: "ks_access" });
        await page.context().clearCookies({ name: "ks_refresh" });
      }
      throw new Error("no unused 98000009xx phone found in 6 tries");
    });

    const suffix = phone.slice(-2);
    const handle = `e2e-sipalu-${suffix}-${Date.now().toString(36)}`;

    await test.step("name", async () => {
      await stepHeading(page, "name");
      await page.getByLabel("Full name (English)").fill(`E2E Sipalu ${suffix}`);
      await saveAndContinue(page);
    });

    await test.step("photo", async () => {
      await stepHeading(page, "photo");
      await page.getByLabel("Your photo").setInputFiles({ name: "face.png", mimeType: "image/png", buffer: PNG });
      await saveAndContinue(page);
    });

    await test.step("skills", async () => {
      await stepHeading(page, "skills");
      await page.getByLabel("Main trade").selectOption("electrician");
      await page.getByLabel("Years").fill("6");
      await saveAndContinue(page);
    });

    await test.step("languages (Nepali is preselected)", async () => {
      await stepHeading(page, "languages");
      await saveAndContinue(page);
    });

    await test.step("service area", async () => {
      await stepHeading(page, "area");
      await page.getByLabel("Your district").selectOption("kathmandu");
      await page.getByLabel("Your municipality").fill("Kathmandu Metropolitan City");
      await expect(page.getByRole("button", { name: /^Remove: Kathmandu/ })).toBeVisible();
      await saveAndContinue(page);
    });

    await test.step("hours (Sunday–Friday 08:00–18:00 by default)", async () => {
      await stepHeading(page, "hours");
      await saveAndContinue(page);
    });

    await test.step("prices: below the minimum hourly rate is refused, a fixed price is added", async () => {
      await stepHeading(page, "prices");
      await page.getByLabel("Trade", { exact: true }).selectOption("electrician");
      await page.getByLabel("Job").fill("Hourly wiring work");
      await page.getByLabel("Price type").selectOption("hourly");
      await page.getByLabel("Price (Rs)").fill("50");
      await page.getByRole("button", { name: "Add service" }).click();
      await expect(page.getByText(/must be at least|minimum wage/i).first()).toBeVisible();
      await page.getByLabel("Price type").selectOption("fixed");
      await page.getByLabel("Job").fill("Ceiling fan installation");
      await page.getByLabel("Price (Rs)").fill("700");
      await page.getByRole("button", { name: "Add service" }).click();
    });

    await test.step("about you", async () => {
      await stepHeading(page, "about");
      await page.getByLabel("One line about your work").fill("Wiring, fans and MCB repairs");
      await saveAndContinue(page);
    });

    await test.step("payment goes to the Sipalu's own wallet", async () => {
      await stepHeading(page, "payment");
      await expect(page.getByText("KaamSathi never holds your money.")).toBeVisible();
      await page.getByRole("radio", { name: "eSewa" }).check();
      await page.getByLabel("eSewa / Khalti ID or bank account number").fill(phone);
      await saveAndContinue(page);
    });

    await test.step("identity", async () => {
      await stepHeading(page, "identity");
      await page.getByLabel("Citizenship number").fill(`27-01-75-${suffix}123`);
      await page.getByLabel("Citizenship — front").setInputFiles({ name: "id-front.png", mimeType: "image/png", buffer: PNG });
      await saveAndContinue(page);
    });

    await test.step("consent is required for a public profile", async () => {
      await stepHeading(page, "consent");
      await saveAndContinue(page);
      await expect(page.getByText("Please agree to show your public profile.")).toBeVisible();
      await page.getByRole("checkbox", { name: /^I agree to show my name/ }).click();
      await saveAndContinue(page);
    });

    await test.step("profile link", async () => {
      await stepHeading(page, "handle");
      await page.getByRole("textbox", { name: "Your profile link" }).fill(handle);
      await saveAndContinue(page);
    });

    await test.step("done: waiting for verification, not bookable or public yet", async () => {
      await stepHeading(page, "done");
      await expect(page.getByRole("link", { name: "See my public profile" })).toHaveAttribute("href", `/sipalu/${handle}`);
      const me = await (await page.request.get("/api/proxy/me/sipalu")).json();
      expect(me.handle).toBe(handle);
      for (const s of ["name", "photo", "skills", "languages", "service_area", "availability", "services", "headline", "payment", "identity", "consent"]) {
        expect(me.completed_steps, `step ${s}`).toContain(s);
      }
      expect(me.bookable).toBe(false); // verification is still pending
      expect((await page.request.get(`/sipalu/${handle}`)).status()).toBe(404);
    });
  });
});
