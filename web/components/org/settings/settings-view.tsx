"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { useSession } from "@/components/providers/session";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoAccess } from "../no-access";
import { OrganizationTab } from "./organization-tab";
import { MembersTab } from "./members-tab";
import { SitesTab } from "./sites-tab";
import { ShiftsTab } from "./shifts-tab";
import { HolidaysTab } from "./holidays-tab";

type TabKey = "organization" | "members" | "sites" | "shifts" | "holidays";

export function SettingsView() {
  const t = useTranslations("settings");
  const { canManage, isAdmin } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tabs = React.useMemo(
    () =>
      [
        { key: "organization", icon: Building2 },
        ...(isAdmin ? [{ key: "members", icon: Users }] : []),
        { key: "sites", icon: MapPin },
        { key: "shifts", icon: Clock },
        { key: "holidays", icon: CalendarDays },
      ] as { key: TabKey; icon: typeof Building2 }[],
    [isAdmin],
  );
  const requested = params.get("tab") as TabKey | null;
  const active: TabKey = tabs.some((x) => x.key === requested) ? requested! : "organization";

  if (!canManage) return <NoAccess />;

  const onChange = (v: string) => {
    const sp = new URLSearchParams(params.toString());
    if (v === "organization") sp.delete("tab");
    else sp.set("tab", v);
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs value={active} onValueChange={onChange}>
        <TabsList aria-label={t("title")}>
          {tabs.map(({ key, icon: Icon }) => (
            <TabsTrigger key={key} value={key}>
              <Icon aria-hidden />
              {t(`tab_${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="organization">
          <OrganizationTab />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="members">
            <MembersTab />
          </TabsContent>
        ) : null}
        <TabsContent value="sites">
          <SitesTab />
        </TabsContent>
        <TabsContent value="shifts">
          <ShiftsTab />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
