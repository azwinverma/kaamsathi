import { expect, test } from "@playwright/test";
import { PHONES, bolauAvailable, expectNoSeriousA11yViolations, loginAs } from "./helpers";

/**
 * Ops console · Bolau (/ops/bolau) as the seeded ops user (9800000003, all staff roles): KPIs
 * render, a Sipalu is suspended and the suspension lifted (both with a reason), and both actions
 * are in the tamper-evident audit log. Always lifts the suspension again, even if a step fails.
 *
 * Suspending turns `bolau_enabled` off and lifting leaves it to the Sipalu to switch back on, so
 * the target is a not-yet-public Sipalu made by bolau-join.spec.ts (handle `e2e-sipalu-…`, runs
 * first) — the demo Sipalu stay untouched.
 */
type Row = { handle: string; name: string; bolau_enabled: boolean; suspended_at: string | null };

test.describe("ops bolau", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await bolauAvailable(page)), "Bolau API not available (flag `bolau` off or backend without apps.bolau)");
  });

  test("KPIs, suspend + lift a Sipalu with a reason, audited (axe)", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const reason = `E2E: suspension check ${stamp}`;
    const note = `E2E: lifted ${stamp}`;
    await loginAs(page, PHONES.ops, "ops");
    const list = await (await page.request.get("/api/proxy/ops/bolau/sipalu?q=e2e-sipalu&page_size=50")).json();
    const candidates = ((list.results ?? []) as Row[]).filter((r) => !r.bolau_enabled && !r.suspended_at && r.name);
    test.skip(!candidates.length, "no E2E-made Sipalu to suspend (run bolau-join.spec.ts first)");
    const TARGET = candidates[0];

    try {
      await test.step("KPIs render", async () => {
        await page.goto("/ops/bolau");
        await expect(page.getByRole("heading", { level: 1, name: "Bolau" })).toBeVisible();
        const kpis = page.getByRole("group", { name: "Bolau KPIs, last 30 days" });
        await expect(kpis).toBeVisible();
        for (const label of ["Bookings / day", "Accepted", "Time to accept", "Completed", "Open disputes"]) {
          await expect(kpis.getByText(label, { exact: true })).toBeVisible();
        }
        await expect(kpis.locator(".skeleton, [aria-busy]")).toHaveCount(0);
        await expectNoSeriousA11yViolations(page, "/ops/bolau");
      });

      await test.step("suspend with a reason", async () => {
        await page.getByRole("tab", { name: "Suspend Sipalu" }).click();
        await page.getByRole("searchbox", { name: "Sipalu handle" }).or(page.getByLabel("Sipalu handle")).first().fill(TARGET.handle);
        const row = page.getByRole("row").filter({ hasText: `@${TARGET.handle}` });
        await expect(row).toHaveCount(1);
        await row.getByRole("button", { name: `Suspend from Bolau ${TARGET.name}` }).click();
        const dialog = page.getByRole("dialog", { name: "Suspend a Sipalu from Bolau" });
        await dialog.getByRole("button", { name: "Suspend from Bolau" }).click();
        await expect(dialog.getByText("A reason is required")).toBeVisible();
        await dialog.getByLabel("Reason (kept in the audit log)").fill(reason);
        await dialog.getByRole("button", { name: "Suspend from Bolau" }).click();
        await expect(dialog).toBeHidden();
        await expect(row.getByText("Suspended", { exact: true })).toBeVisible();
        await expect(row.getByText(reason)).toBeVisible();
      });

      await test.step("lift the suspension", async () => {
        const row = page.getByRole("row").filter({ hasText: `@${TARGET.handle}` });
        await row.getByRole("button", { name: `Lift suspension ${TARGET.name}` }).click();
        const dialog = page.getByRole("dialog", { name: "Lift suspension" });
        await dialog.getByLabel("Reason (kept in the audit log)").fill(note);
        await dialog.getByRole("button", { name: "Lift suspension" }).click();
        await expect(dialog).toBeHidden();
        await expect(row.getByText("Suspended", { exact: true })).toBeHidden();
        await expect(row.getByText("Pending", { exact: true })).toBeVisible(); // localized, not "pending"
        await expect(row.getByRole("button", { name: `Suspend from Bolau ${TARGET.name}` })).toBeVisible();
      });

      await test.step("both actions are in the audit log", async () => {
        const suspend = await (await page.request.get("/api/proxy/ops/audit?action=bolau.ops.sipalu.suspend&page_size=20")).json();
        expect(suspend.results.some((r: { changes: { reason?: string } }) => r.changes?.reason === reason)).toBe(true);
        const lift = await (await page.request.get("/api/proxy/ops/audit?action=bolau.ops.sipalu.unsuspend&page_size=20")).json();
        expect(lift.results.some((r: { changes: { note?: string } }) => r.changes?.note === note)).toBe(true);
      });
    } finally {
      // Never leave the demo Sipalu suspended (no-op when already lifted).
      const res = await page.request.get(`/api/proxy/ops/bolau/sipalu?q=${TARGET.handle}`);
      const row = res.ok() ? (await res.json()).results?.[0] : null;
      if (row?.suspended_at) {
        await page.request.post(`/api/proxy/ops/bolau/sipalu/${TARGET.handle}/unsuspend`, {
          data: { note: "E2E: cleanup" },
          headers: { origin: new URL(page.url()).origin },
        });
      }
    }
  });
});
