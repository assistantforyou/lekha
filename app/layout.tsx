import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const bodyFont = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const displayFont = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lekha — A secretary who lives in your LINE",
  description:
    "She drafts your email, sends it, watches your calendar, and remembers what matters.",
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
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
