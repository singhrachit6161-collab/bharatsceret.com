import type { Metadata } from "next";
import { ContentPage } from "@/components/store/ContentPage";

export const metadata: Metadata = { title: "About us", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return <ContentPage slug="about" />;
}
