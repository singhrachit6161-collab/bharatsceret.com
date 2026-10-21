import type { Metadata } from "next";
import { AddressBook } from "@/components/store/AddressBook";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select("id, full_name, phone, line1, line2, landmark, city, state, pincode, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at");
  return (
    <div>
      <h1 className="section-title mb-6">Saved addresses</h1>
      <AddressBook addresses={(data ?? []) as Address[]} />
    </div>
  );
}
