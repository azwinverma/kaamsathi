import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers/providers";
import { THEME_STORAGE_KEY } from "@/lib/cookies";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Fonts per design/tokens.json: Inter (Latin) + Noto Sans Devanagari (Nepali). Both are variable
// fonts, so every weight in the 400–800 scale comes from one file each.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["latin", "devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  const locale = await getLocale();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${t("name")} — ${t("tagline")}`, template: `%s · ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
    },
    // og:image comes from app/opengraph-image.tsx; /apple-icon is app/apple-icon.tsx.
    openGraph: {
      type: "website",
      siteName: t("name"),
      title: `${t("name")} — ${t("tagline")}`,
      description: t("tagline"),
      locale: locale === "ne" ? "ne_NP" : "en_US",
      alternateLocale: locale === "ne" ? ["en_US"] : ["ne_NP"],
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // surface.default from design/tokens.json: light is the default theme (dark only by choice).
  themeColor: "#ffffff",
  colorScheme: "light",
};

// Applies a user-chosen dark theme before first paint (avoids a flash). Default is light.
const themeScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"){document.documentElement.dataset.theme="dark";var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content="dark"}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${notoDevanagari.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Kathmandu">
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
