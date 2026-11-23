import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { LeavePage, lockingRun } from "./leave-page";

const leave = (id: string, from: string, to: string) => ({
  id,
  employment: { id: `e-${id}`, worker: { id: `w-${id}`, full_name: `Worker ${id}` }, designation: "Cook" },
  leave_type: "home",
  from_date: from,
  to_date: to,
  days: 2,
  reason: "",
  status: "pending",
  decided_at: null,
  decision_note: "",
  created_at: "2026-10-01T00:00:00Z",
});
const runs = [
  { id: "r1", bs_year: 2083, bs_month: 6, period_start: "2026-09-17", period_end: "2026-10-17", status: "approved" },
  { id: "r2", bs_year: 2083, bs_month: 7, period_start: "2026-10-18", period_end: "2026-11-16", status: "draft" },
];

vi.mock("@/components/providers/session", () => ({ useSession: () => ({ canManage: true }) }));
vi.mock("@/lib/api/hooks/workforce", () => ({
  useLeaves: () => ({
    data: { count: 2, results: [leave("locked", "2026-10-16", "2026-10-19"), leave("open", "2026-11-01", "2026-11-02")] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  }),
  useDecideLeave: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateLeave: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  usePayrollRunsForLock: () => ({ data: { count: runs.length, results: runs } }),
}));
vi.mock("./employment-picker", () => ({ EmploymentPicker: () => null }));

describe("Leave page: locked payroll months", () => {
  it("finds the approved run a leave overlaps", () => {
    expect(lockingRun({ from_date: "2026-10-16", to_date: "2026-10-19" }, runs as never)?.id).toBe("r1");
    expect(lockingRun({ from_date: "2026-11-01", to_date: "2026-11-02" }, runs as never)).toBeUndefined();
  });

  it("hides Approve for a leave in an approved payroll month and explains why", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kathmandu">
        <LeavePage />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("button", { name: "Approve leave for Worker locked" })).not.toBeInTheDocument();
    expect(screen.getByText(/Payroll for Ashwin 2083 is approved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject leave for Worker locked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve leave for Worker open" })).toBeInTheDocument();
  });
});
