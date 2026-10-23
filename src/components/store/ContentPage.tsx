import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Markdownish } from "@/components/ui/Markdownish";
import { getContentPage } from "@/lib/data/settings";

export async function ContentPage({ slug, crumbs = [] }: { slug: string; crumbs?: { name: string; href?: string }[] }) {
  const page = await getContentPage(slug);
  if (!page) notFound();
  return (
    <div className="container-page max-w-3xl pb-16">
      <Breadcrumbs items={[...crumbs, { name: page.title }]} />
      <h1 className="section-title mb-2">{page.title}</h1>
      <p className="mb-8 text-xs text-muted">Last updated {new Date(page.updated_at).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
      <Markdownish text={page.body} />
    </div>
  );
}
