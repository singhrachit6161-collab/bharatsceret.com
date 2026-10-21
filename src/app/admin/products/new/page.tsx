import { AdminCrumbs, PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export default async function NewProduct() {
  await requireStaffPage(ADMIN_ROLES);
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (
    <div className="max-w-5xl">
      <AdminCrumbs items={[{ name: "Products", href: "/admin/products" }, { name: "New" }]} />
      <PageHeader title="New product" description="Create the product as a draft, then add variants and images before publishing." />
      <ProductForm categories={(data ?? []) as Category[]} selected={[]} />
    </div>
  );
}
