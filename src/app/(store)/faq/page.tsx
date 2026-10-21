import type { Metadata } from "next";
import { ContentPage } from "@/components/store/ContentPage";

export const metadata: Metadata = { title: "FAQs", alternates: { canonical: "/faq" } };

export default function FaqPage() {
  return <ContentPage slug="faq" />;
}
