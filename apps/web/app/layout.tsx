import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { LocationTracker } from "@/components/LocationTracker";
import { AppSplash } from "@/components/AppSplash";
import "./globals.css";

const display = localFont({
  src: "./fonts/Outfit-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Realty Smartz Private Limited HRMS",
  description: "Internal HR management system — Realty Smartz Private Limited",
  applicationName: "Realty Smartz Private Limited HRMS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RS HRMS",
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5D3EBC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <AppSplash />
          <PwaInstallBanner />
          {children}
          <LocationTracker />
        </Providers>
      </body>
    </html>
  );
}
