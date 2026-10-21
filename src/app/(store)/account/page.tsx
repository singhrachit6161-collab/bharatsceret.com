import type { Metadata } from "next";
import Link from "next/link";
import { OrderList } from "@/components/store/OrderList";
import { ProfileForm } from "@/components/store/ProfileForm";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrderSummary } from "@/lib/types";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ denied?: string; password?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, status, payment_method, payment_status, total_paise, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  return (
    <div className="space-y-8">
      <h1 className="section-title">Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
      {sp.denied && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">You do not have access to the admin panel.</p>}
      {sp.password && <p className="rounded-md bg-success/10 p-3 text-sm text-success">Your password has been updated.</p>}
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold text-walnut">Profile</h2>
        <ProfileForm fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-walnut">Recent orders</h2>
          <Link href="/account/orders" className="text-sm font-semibold text-saffron-600">View all</Link>
        </div>
        {orders?.length ? <OrderList orders={orders as OrderSummary[]} /> : <p className="text-sm text-muted">No orders yet.</p>}
      </section>
    </div>
  );
}
