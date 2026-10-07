import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/messages/en.json";
import { ChartCard, ColumnChart, HBarList } from "./charts";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kathmandu">
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>,
  );
}

describe("charts", () => {
  it("renders suppressed cells as hidden, never as zero", () => {
    wrap(
      <HBarList
        ariaLabel="Absence"
        rows={[
          { key: "a", label: "Site A", value: 12.5, display: "12.5%" },
          { key: "b", label: "Site B", value: null, suppressed: true },
        ]}
      />,
    );
    expect(screen.getByText("12.5%")).toBeInTheDocument();
    expect(screen.getByText("under 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Site B: Hidden — fewer than 5 workers")).toBeInTheDocument();
  });

  it("every column is keyboard-focusable with an accessible label; only the last is direct-labelled", () => {
    wrap(
      <ColumnChart
        ariaLabel="Headcount"
        data={[
          { key: "1", label: "Bai", value: 10, display: "10" },
          { key: "2", label: "Jes", value: 12, display: "12" },
        ]}
      />,
    );
    expect(screen.getByLabelText("Bai: 10")).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByText("10")).toBeNull();
  });

  it("chart card toggles a table view", async () => {
    wrap(
      <ChartCard title="Demo" table={{ columns: [{ key: "m", label: "Month" }], rows: [{ m: "Baisakh" }] }}>
        <p>chart body</p>
      </ChartCard>,
    );
    expect(screen.getByText("chart body")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /view as table/i }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Baisakh")).toBeInTheDocument();
  });
});
