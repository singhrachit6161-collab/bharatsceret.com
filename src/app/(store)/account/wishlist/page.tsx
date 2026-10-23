import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/store/ProductSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth";
import { getListingsByIds } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_items").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false });
  const products = await getListingsByIds((data ?? []).map((r) => r.product_id as string));
  return (
    <div>
      <h1 className="section-title mb-6">Wishlist</h1>
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState icon={<Heart size={36} />} title="Your wishlist is empty" description="Tap “Add to wishlist” on any product to save it here." actionHref="/shop" actionLabel="Browse products" />
      )}
    </div>
  );
}
