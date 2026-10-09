import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { GharShell, gharActive } from "./ghar-shell";

const flags = { data: { flags: {} as Record<string, boolean> }, isLoading: false };

vi.mock("next/navigation", () => ({
  usePathname: () => "/ghar",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/api/hooks/auth", () => ({
  useMe: () => ({ data: { full_name: "Sita Shrestha", phone: "9800000020" }, isLoading: false, error: null }),
}));
vi.mock("@/lib/api/hooks/flags", () => ({ useClientFlags: () => flags }));

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kathmandu">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("GharShell", () => {
  it("hides the Ghardhani area when the bolau flag is off", () => {
    flags.data.flags = {};
    wrap(
      <GharShell>
        <p>bookings list</p>
      </GharShell>,
    );
    expect(screen.queryByText("bookings list")).not.toBeInTheDocument();
    expect(screen.getByText("Bolau isn't switched on for your account yet.")).toBeInTheDocument();
  });

  it("shows the area and its tabs when the flag is on", () => {
    flags.data.flags = { bolau: true };
    wrap(
      <GharShell>
        <p>bookings list</p>
      </GharShell>,
    );
    expect(screen.getByText("bookings list")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Kaam requests" })).toBeInTheDocument();
  });

  it("highlights the right tab for nested pages", () => {
    expect(gharActive("/ghar")).toBe("/ghar");
    expect(gharActive("/ghar/bookings/abc")).toBe("/ghar");
    expect(gharActive("/ghar/requests/xyz")).toBe("/ghar/requests");
    expect(gharActive("/ghar/addresses")).toBe("/ghar/addresses");
  });
});
