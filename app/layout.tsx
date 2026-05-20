import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEKHA · เลขา — Your AI Executive Assistant",
  description:
    "LEKHA briefs you twice a day, runs your to-do list, watches your calendar, drafts replies, analyses markets, and more — all in one LINE chat.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    images: ["/og.png"],
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
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
