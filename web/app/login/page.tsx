import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginFlow } from "@/components/auth/login-flow";
import { AuthFrame } from "@/components/auth/auth-frame";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("meta_title") };
}

export default function LoginPage() {
  return (
    <AuthFrame>
      <Suspense>
        <LoginFlow />
      </Suspense>
    </AuthFrame>
  );
}
