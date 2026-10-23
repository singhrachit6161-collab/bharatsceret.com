"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { addressSchema, fieldErrors, profileSchema } from "@/lib/validation";

export type AddressFormState = { ok: boolean; message?: string; errors?: Record<string, string>; addressId?: string } | null;

export async function saveAddress(_prev: AddressFormState, formData: FormData): Promise<AddressFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in." };
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Please check the highlighted fields." };
  const id = formData.get("id");
  const supabase = await createClient();

  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const makeDefault = parsed.data.is_default || (count ?? 0) === 0;
  if ((count ?? 0) >= 20 && !id) return { ok: false, message: "You can save up to 20 addresses." };
  if (makeDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  }
  const row = { ...parsed.data, is_default: makeDefault, user_id: user.id };
  const res =
    typeof id === "string" && z.uuid().safeParse(id).success
      ? await supabase.from("addresses").update(row).eq("id", id).eq("user_id", user.id).select("id").single()
      : await supabase.from("addresses").insert(row).select("id").single();
  if (res.error) return { ok: false, message: "Could not save the address. Please try again." };
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true, message: "Address saved.", addressId: res.data.id };
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || !z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not delete the address." };
  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || !z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not update the address." };
  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function updateProfile(_prev: AddressFormState, formData: FormData): Promise<AddressFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone ?? null })
    .eq("id", user.id);
  if (error) return { ok: false, message: "Could not update your profile." };
  revalidatePath("/account");
  return { ok: true, message: "Profile updated." };
}

export async function cancelMyOrder(orderId: string, reason: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || !z.uuid().safeParse(orderId).success) return { ok: false, error: "Invalid request." };
  const r = z.string().trim().min(3).max(300).safeParse(reason);
  if (!r.success) return { ok: false, error: "Please tell us why you are cancelling (at least 3 characters)." };
  const supabase = await createClient();
  // cancel_order checks ownership and which states a customer may cancel.
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId, p_reason: `Customer: ${r.data}` });
  if (error) return { ok: false, error: friendlyError(error) };
  const { data: order } = await supabase.from("orders").select("order_number, contact_email").eq("id", orderId).maybeSingle();
  if (order) await notify("order_cancelled", { to: order.contact_email, orderNumber: order.order_number });
  revalidatePath("/account/orders");
  return { ok: true };
}
