import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";

/** Seeded demo accounts (backend `manage.py seed_demo`). */
export const PHONES = {
  employer: "9800000001", // owner — Hotel Annapurna View + Shivam Builders
  supervisor: "9800000002",
  ops: "9800000003", // ops staff, all roles
  worker: "9800000010", // Ram Bahadur Thapa
} as const;

/** Dev OTP code (backend OTP_DEV_CODE, only honoured with DEBUG on). */
export const OTP_CODE = process.env.E2E_OTP_CODE || "123456";

export type Workspace = "app" | "ops";

const WORKSPACE_URL = /\/(app|ops)(\/|\?|#|$)/;

function inWorkspace(page: Page): boolean {
  return WORKSPACE_URL.test(new URL(page.url()).pathname);
}

/** Tick every pending legal document and accept (login card or the /app|/ops LegalGate screen). */
async function acceptLegal(page: Page) {
  const boxes = page.getByRole("checkbox", { name: /^I have read and accept/ });
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    const box = boxes.nth(i);
    if ((await box.getAttribute("aria-checked")) !== "true") await box.click();
  }
  await page.getByRole("button", { name: "Accept and continue" }).click();
}

/**
 * Log in through the real UI: phone → OTP (dev code) → optional legal acceptance → optional
 * workspace choice. Resolves once the browser is on /app or /ops.
 */
export async function login(page: Page, phone: string, workspace: Workspace = "app") {
  await page.goto("/login");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();

  // The first box accepts the whole code: OtpInput fills forward and auto-submits on 6 digits.
  const firstBox = page.getByRole("textbox", { name: "Digit 1 of 6" });
  await expect(firstBox).toBeVisible();
  await firstBox.fill(OTP_CODE);

  const legalHeading = page.getByRole("heading", { name: "Please review our updated terms" });
  const chooseHeading = page.getByRole("heading", { name: /^Welcome back/ });

  // Walk through whichever post-OTP steps appear, until we land in a workspace.
  for (let step = 0; step < 4; step++) {
    const seen: { state: "legal" | "choose" | "done" | "pending" } = { state: "pending" };
    await expect(async () => {
      if (await legalHeading.isVisible()) seen.state = "legal";
      else if (await chooseHeading.isVisible()) seen.state = "choose";
      else if (inWorkspace(page)) seen.state = "done";
      else seen.state = "pending";
      expect(seen.state, `login for ${phone} did not reach /app or /ops (url: ${page.url()})`).not.toBe(
        "pending",
      );
    }).toPass({ timeout: 45_000 });
    const state = seen.state;

    if (state === "legal") {
      await acceptLegal(page);
      await expect(legalHeading).toBeHidden();
    } else if (state === "choose") {
      const name = workspace === "ops" ? "Ops console" : "Employer portal";
      await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
      await page.waitForURL(WORKSPACE_URL);
    } else {
      break;
    }
  }

  await expect(page).toHaveURL(WORKSPACE_URL);
  // The shell renders a page <h1> once the session has loaded; handle the LegalGate screen too.
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  if (await legalHeading.isVisible()) {
    await acceptLegal(page);
    await expect(legalHeading).toBeHidden();
  }
}

/**
 * Like `login`, but reuses the session cookies from an earlier UI login of the same phone in this
 * worker. The backend allows only 5 OTP requests per phone per hour (OTP_MAX_PER_HOUR), so specs
 * that only need *a* session should use this.
 */
const sessions = new Map<string, Awaited<ReturnType<BrowserContext["storageState"]>>>();

export async function loginAs(page: Page, phone: string, workspace: Workspace = "app") {
  const cached = sessions.get(`${phone}:${workspace}`);
  if (cached) {
    await page.context().addCookies(cached.cookies);
    await page.goto(workspace === "ops" ? "/ops" : "/app");
    if (inWorkspace(page)) {
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      return;
    }
    sessions.delete(`${phone}:${workspace}`);
  }
  await login(page, phone, workspace);
  sessions.set(`${phone}:${workspace}`, await page.context().storageState());
}

/** Unique, human-readable name for records created by a test. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Axe scan (WCAG 2.0 A + AA). Fails only on serious/critical violations and lists each rule id
 * with the offending element selectors in the assertion message.
 */
export async function expectNoSeriousA11yViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const report = serious
    .map((v) => {
      const targets = v.nodes
        .slice(0, 10)
        .map((n) => `      - ${n.target.join(" ")}`)
        .join("\n");
      const more = v.nodes.length > 10 ? `\n      … and ${v.nodes.length - 10} more` : "";
      return `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n${targets}${more}`;
    })
    .join("\n");
  expect(
    serious.map((v) => v.id),
    `Serious/critical a11y violations on ${context}:\n${report}`,
  ).toEqual([]);
}
