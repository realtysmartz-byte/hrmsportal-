import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import { LocationTracker } from "@/components/LocationTracker";
import { AppSplash } from "@/components/AppSplash";
import { NativeAppBoot } from "@/components/NativeAppBoot";
import "./globals.css";

const display = localFont({
  src: "./fonts/Outfit-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HRMS",
  description: "Internal HR management system — Realty Smartz Private Limited",
  applicationName: "HRMS",
  manifest: "/manifest.webmanifest?v=3",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HRMS",
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "auto",
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var m = window.matchMedia('(prefers-color-scheme: dark)');
                  function updateTheme() {
                    if (m.matches) {
                      document.documentElement.classList.add('dark');
                      document.documentElement.setAttribute('data-theme', 'dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                      document.documentElement.removeAttribute('data-theme');
                    }
                  }
                  updateTheme();
                  if (m.addEventListener) {
                    m.addEventListener('change', updateTheme);
                  } else if (m.addListener) {
                    m.addListener(updateTheme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <NativeAppBoot />
          <AppSplash />
          {children}
          <LocationTracker />
        </Providers>
      </body>
    </html>
  );
}
