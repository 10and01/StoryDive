import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import { cn } from "@/utils/utils";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LocaleSyncEffect } from "@/components/i18n/locale-sync-effect";
import { UserProvider } from "@/components/user-profile/user-provider";
import { BranchProvider } from "@/components/story/branch-store";
import { getServerLocale } from "@/lib/i18n/server-preference";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const notoSans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans-sc",
});
const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-heading",
});

// 部署后可通过 NEXT_PUBLIC_SITE_URL 覆盖分享卡片的规范域名。
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined;

const SITE_TITLE = process.env.NEXT_PUBLIC_APP_TITLE?.trim() || "入局";
const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "知乎盐言故事的互动叙事游乐场：入局一个名场面，对戏、分叉、改写，走出你的结局。";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        "font-sans",
        geist.variable,
        notoSans.variable,
        notoSerif.variable,
      )}
    >
      <body className="h-full flex flex-col">
        <I18nProvider>
          <UserProvider>
            <LocaleSyncEffect />
            <BranchProvider>{children}</BranchProvider>
            <Toaster />
          </UserProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
