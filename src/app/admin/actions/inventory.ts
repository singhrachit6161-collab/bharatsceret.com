"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext, audit, denied, formString, refreshStorefront, type AdminFormState } from "@/lib/admin";
import { friendlyError } from "@/lib/errors";

const LARGE_CHANGE = 500;

export async function adjustStock(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db } = await adminContext();
    const variantId = formString(fd, "variant_id");
    const delta = Number(formString(fd, "delta"));
    const reason = formString(fd, "reason");
    if (!z.uuid().safeParse(variantId).success) return { ok: false, message: "Invalid variant." };
    if (!Number.isInteger(delta) || delta === 0) return { ok: false, message: "Enter a non-zero whole number (negative to remove stock)." };
    if (reason.length < 3) return { ok: false, message: "A reason is required for every stock change." };
    if (Math.abs(delta) >= LARGE_CHANGE && formString(fd, "confirm_large") !== "on") {
      return { ok: false, message: `Changes of ${LARGE_CHANGE}+ units need the confirmation box ticked.` };
    }
    const { data, error } = await db.rpc("adjust_inventory", { p_variant_id: variantId, p_delta: delta, p_note: reason });
    if (error) return { ok: false, message: friendlyError(error) };
    refreshStorefront();
    revalidatePath("/admin/inventory");
    return { ok: true, message: `Stock updated. On hand: ${data}.` };
  } catch (e) {
    return denied(e);
  }
}

export async function setThreshold(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext();
    const variantId = formString(fd, "variant_id");
    const threshold = Number(formString(fd, "threshold"));
    if (!z.uuid().safeParse(variantId).success || !Number.isInteger(threshold) || threshold < 0 || threshold > 100000) {
      return { ok: false, message: "Enter a valid threshold." };
    }
    const { error } = await db.from("inventory").update({ low_stock_threshold: threshold }).eq("variant_id", variantId);
    if (error) return { ok: false, message: "Could not update threshold." };
    await audit(db, user.id, "inventory.threshold", "variant", variantId, { threshold });
    revalidatePath("/admin/inventory");
    return { ok: true, message: "Threshold saved." };
  } catch (e) {
    return denied(e);
  }
}
