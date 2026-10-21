import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const body = Manrope({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const display = Cormorant_Garamond({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "Bharat Secret — Premium Dry Fruits", template: "%s | Bharat Secret" },
  description:
    "Bharat Secret — premium almonds, cashews, walnuts, pistachios, dates and luxury gift hampers, curated and delivered across India.",
  openGraph: { type: "website", siteName: "Bharat Secret", locale: "en_IN" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1F1612",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${body.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
