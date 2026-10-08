import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotificationTemplatesPage } from "@/components/notifications/templates-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notif_templates");
  return { title: t("meta_title") };
}

export default function OpsNotificationsRoute() {
  return <NotificationTemplatesPage />;
}
