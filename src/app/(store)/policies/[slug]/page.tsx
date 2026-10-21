import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/store/ContentPage";
import { getContentPage } from "@/lib/data/settings";

const POLICY_SLUGS = ["shipping-policy", "returns-policy", "privacy-policy", "terms"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = POLICY_SLUGS.includes(slug) ? await getContentPage(slug) : null;
  return page ? { title: page.title, alternates: { canonical: `/policies/${slug}` } } : { title: "Not found" };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!POLICY_SLUGS.includes(slug)) notFound();
  return <ContentPage slug={slug} />;
}
