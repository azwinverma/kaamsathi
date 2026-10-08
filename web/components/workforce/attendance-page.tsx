"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ClipboardCheck, Grid3x3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { usePendingCorrectionsCount } from "@/lib/api/hooks/corrections";
import { useFormat } from "@/lib/use-format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceDay } from "./attendance-day";
import { AttendanceRegisterView } from "./attendance-register";
import { AttendanceWeek } from "./attendance-week";

export function AttendancePage() {
  const t = useTranslations();
  const ta = useTranslations("workforce.attendance");
  const tcr = useTranslations("corrections");
  const f = useFormat();
  const pendingCorrections = usePendingCorrectionsCount();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get("tab") === "register" ? "register" : "day";
  const setTab = (v: string) => {
    const sp = new URLSearchParams(params.toString());
    if (v === "register") sp.set("tab", "register");
    else sp.delete("tab");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  return (
    <div>
      <PageHeader
        title={t("nav.attendance")}
        description={ta("description")}
        actions={
          <Button variant="secondary" asChild>
            <Link
              href="/app/attendance/corrections?status=pending"
              aria-label={
                pendingCorrections
                  ? tcr("entry_pending", { count: pendingCorrections })
                  : tcr("entry")
              }
            >
              <ClipboardCheck aria-hidden />
              {tcr("entry")}
              {pendingCorrections ? (
                <Badge tone="warning" aria-hidden>
                  {f.digits(pendingCorrections)}
                </Badge>
              ) : null}
            </Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="day">
            <CalendarDays aria-hidden />
            {ta("tab_day")}
          </TabsTrigger>
          <TabsTrigger value="register">
            <Grid3x3 aria-hidden />
            {ta("tab_register")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="day" className="space-y-8">
          <AttendanceDay />
          <AttendanceWeek moreHref="/app/attendance?tab=register" />
        </TabsContent>
        <TabsContent value="register">
          <AttendanceRegisterView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
