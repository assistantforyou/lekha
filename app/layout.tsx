import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEKHA — Your AI Executive Assistant",
  description:
    "LEKHA is a bilingual (English / ไทย) AI executive assistant: daily briefings, tasks, calendar, email, stock analysis, and research — all in one chat.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    images: ["/og.png"],
  },
  verification: {
    google: "4xqUAcs7B-h68az0S75Va3P9sn6JhK9Ea6tL8wQqdLA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050d22",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Sora:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/countup.js/2.6.2/countUp.umd.js"
          strategy="beforeInteractive"
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
