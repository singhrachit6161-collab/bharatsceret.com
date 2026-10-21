import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const body = DM_Sans({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const display = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "SwaadVana — Premium Dry Fruits", template: "%s | SwaadVana" },
  description:
    "Shop almonds, cashews, walnuts, pistachios, raisins, dates, seeds and festive gift hampers. Carefully packed and delivered across India.",
  openGraph: { type: "website", siteName: "SwaadVana", locale: "en_IN" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#38251D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${body.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
