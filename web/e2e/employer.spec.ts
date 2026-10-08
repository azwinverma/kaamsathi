import { expect, test } from "@playwright/test";
import { PHONES, login, uniqueName } from "./helpers";

/**
 * Employer owner journey on seeded demo data: dashboard → post a job (minimum-wage guard) →
 * pipeline → mark hajiri → open a payroll run's wage sheet. One login, serial steps.
 */
test("employer: post job, pipeline, hajiri and payroll", async ({ page }) => {
  await test.step("log in and see the dashboard", async () => {
    await login(page, PHONES.employer);
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: /^(Namaste, |Dashboard)/ })).toBeVisible();
  });

  const title = uniqueName("E2E Mason");

  await test.step("post a job: below minimum wage is rejected, then saved", async () => {
    await page.goto("/app/jobs");
    await expect(page.getByRole("heading", { level: 1, name: "Job openings" })).toBeVisible();
    await page.getByRole("button", { name: "New job" }).first().click();

    const dialog = page.getByRole("dialog", { name: "New job opening" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Job title").fill(title);
    const trade = dialog.getByLabel("Trade");
    await expect(trade).toBeEnabled(); // trades load from /ref
    await trade.selectOption({ index: 1 });

    await dialog.getByLabel("Start date").click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(dialog.getByLabel("Start date")).not.toContainText("Select date");

    // Monthly minimum is Rs 19,550 (Basic + DA); 10,000 must be refused.
    const wage = dialog.getByLabel("Monthly salary (Basic + DA)");
    await wage.fill("10000");
    await dialog.getByRole("button", { name: "Save as draft" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: /below the government minimum wage/i })).toBeVisible();
    await expect(dialog).toBeVisible(); // not submitted

    await wage.fill("20000");
    await expect(dialog.getByText(/below the government minimum wage/i)).toBeHidden();
    await dialog.getByRole("button", { name: "Save as draft" }).click();

    await expect(page.getByText("Draft job saved")).toBeVisible();
    await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  });

  await test.step("open the job's candidate pipeline", async () => {
    await expect(page.getByRole("heading", { name: "Candidate pipeline" })).toBeVisible();
    // A seeded open job has candidates in its pipeline.
    await page.goto("/app/jobs");
    await page.getByRole("link", { name: "View pipeline" }).first().click();
    await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Candidate pipeline" })).toBeVisible();
  });

  await test.step("mark hajiri (present) for one worker", async () => {
    await page.goto("/app/attendance");
    await expect(page.getByRole("heading", { level: 1, name: "Hajiri (Attendance)" })).toBeVisible();
    const row = page.getByRole("radiogroup", { name: /^Hajiri for / }).first();
    await expect(row).toBeVisible();
    const present = row.getByRole("radio", { name: "Present", exact: true });
    const save = page.getByRole("button", { name: "Save", exact: true });

    if ((await present.getAttribute("aria-checked")) === "true") {
      // Already present from seed/earlier run: flip to absent first so "present" is a real change.
      await row.getByRole("radio", { name: "Absent", exact: true }).click();
      await save.click();
      await expect(page.getByText("Saved hajiri for 1 worker").first()).toBeVisible();
      await expect(save).toBeHidden();
    }

    await present.click();
    await expect(present).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("1 unsaved change")).toBeVisible();
    await save.click();
    await expect(page.getByText("Saved hajiri for 1 worker").last()).toBeVisible();
    await expect(save).toBeHidden();
    await expect(present).toHaveAttribute("aria-checked", "true");
  });

  await test.step("open a payroll run and see its wage sheet", async () => {
    await page.goto("/app/payroll");
    await page.getByRole("link", { name: /^Open wage sheet for / }).first().click();
    await expect(page).toHaveURL(/\/app\/payroll\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Wage sheet (Talab pana)" })).toBeVisible();
    const sheet = page.getByRole("region", { name: "Wage sheet (Talab pana)" }).getByRole("table");
    await expect(sheet.getByRole("columnheader", { name: "Worker" })).toBeVisible();
    await expect(sheet.getByRole("columnheader", { name: "Net pay" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open payslip for / }).first()).toBeVisible();
  });
});
