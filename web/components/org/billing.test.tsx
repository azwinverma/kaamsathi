import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";
import { BillingView } from "./billing";

const summary: { data: Record<string, unknown> } = { data: {} };
const plan = {
  code: "pilot",
  code_label: "Pilot",
  name: "Pilot",
  monthly_base: "0.00",
  per_active_worker: "150.00",
  min_monthly: "3000.00",
  placement_fee: "5000.00",
  included_workers: 0,
};
const empty = { data: { count: 0, results: [] }, isLoading: false, error: null, refetch: vi.fn() };

vi.mock("@/components/providers/session", () => ({ useSession: () => ({ isAdmin: true }) }));
vi.mock("@/lib/api/hooks/org", () => ({
  useBillingSummary: () => ({ ...summary, isLoading: false, error: null, refetch: vi.fn() }),
  useCharges: () => empty,
}));
vi.mock("@/lib/api/hooks/billing", () => ({
  useOrgSubscription: () => ({ data: { plan }, isLoading: false }),
  useOrgInvoices: () => empty,
}));

function wrap(locale: "en" | "ne" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ne} timeZone="Asia/Kathmandu">
      <BillingView />
    </NextIntlClientProvider>,
  );
}

const base = { active_workers: 3, monthly_estimate: "3000.00", unpaid_total: "0.00", outstanding_invoices: 0 };

describe("Billing summary: free pilot", () => {
  it("shows the free pilot with days left", () => {
    summary.data = { ...base, pilot: true, pilot_days_left: 12, pilot_ends_on: "2026-12-05" };
    wrap();
    expect(screen.getByText("Free pilot")).toBeInTheDocument();
    expect(screen.getByText(/12 days left/)).toBeInTheDocument();
  });

  it("says it in Nepali too", () => {
    summary.data = { ...base, pilot: true, pilot_days_left: 12, pilot_ends_on: "2026-12-05" };
    wrap("ne");
    expect(screen.getByText("निःशुल्क पाइलट")).toBeInTheDocument();
    expect(screen.getByText(/दिन बाँकी/)).toBeInTheDocument();
  });

  it("after the pilot the default price list reads Standard", () => {
    summary.data = { ...base, pilot: false, pilot_days_left: null, pilot_ends_on: null };
    wrap();
    expect(screen.queryByText("Free pilot")).not.toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
  });
});
