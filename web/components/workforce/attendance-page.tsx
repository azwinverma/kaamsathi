"use client";
import * as React from "react";
import { CalendarDays, Grid3x3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceDay } from "./attendance-day";
import { AttendanceRegisterView } from "./attendance-register";

export function AttendancePage() {
  const t = useTranslations();
  const ta = useTranslations("workforce.attendance");
  const [tab, setTab] = React.useState("day");
  return (
    <div>
      <PageHeader title={t("nav.attendance")} description={ta("description")} />
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
        <TabsContent value="day">
          <AttendanceDay />
        </TabsContent>
        <TabsContent value="register">
          <AttendanceRegisterView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
