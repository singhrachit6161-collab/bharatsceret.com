import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import type { CodRules, ShippingRules } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export interface StoreSettings {
  announcement: { enabled: boolean; message: string; link_label?: string; link_url?: string };
  store_contact: {
    brand_name: string;
    legal_name: string;
    email: string;
    phone: string;
    whatsapp: string;
    address: string;
    hours: string;
    fssai_license: string;
  };
  shipping: {
    flat_fee_paise: number;
    free_shipping_threshold_paise: number | null;
    estimated_days_min: number;
    estimated_days_max: number;
    serviceable_pincode_prefixes: string[];
  };
  cod: { enabled: boolean; fee_paise: number; min_order_paise: number; max_order_paise: number };
  checkout: { reservation_minutes: number };
  social: { instagram: string; facebook: string; youtube: string; x: string };
  trust_strip: { icon: string; title: string; text: string }[];
}

export const DEFAULT_SETTINGS: StoreSettings = {
  announcement: { enabled: false, message: "" },
  store_contact: {
    brand_name: "SwaadVana",
    legal_name: "",
    email: "",
    phone: "",
    whatsapp: "",
    address: "",
    hours: "",
    fssai_license: "",
  },
  shipping: {
    flat_fee_paise: 6900,
    free_shipping_threshold_paise: 99900,
    estimated_days_min: 3,
    estimated_days_max: 7,
    serviceable_pincode_prefixes: [],
  },
  cod: { enabled: false, fee_paise: 0, min_order_paise: 0, max_order_paise: 0 },
  checkout: { reservation_minutes: 30 },
  social: { instagram: "", facebook: "", youtube: "", x: "" },
  trust_strip: [],
};

export const getSettings = cache(async (): Promise<StoreSettings> => {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").select("key, value");
  if (error || !data) return DEFAULT_SETTINGS;
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of data) {
    const def = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[row.key];
    if (def === undefined) continue;
    merged[row.key] =
      Array.isArray(def) || typeof row.value !== "object" || Array.isArray(row.value)
        ? row.value
        : { ...(def as object), ...(row.value as object) };
  }
  return merged as unknown as StoreSettings;
});

export function shippingRules(s: StoreSettings): ShippingRules {
  return {
    flatFeePaise: s.shipping.flat_fee_paise,
    freeShippingThresholdPaise: s.shipping.free_shipping_threshold_paise,
  };
}

export function codRules(s: StoreSettings): CodRules {
  return {
    enabled: s.cod.enabled,
    feePaise: s.cod.fee_paise,
    minOrderPaise: s.cod.min_order_paise,
    maxOrderPaise: s.cod.max_order_paise,
  };
}

export const getContentPage = cache(async (slug: string) => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("content_pages").select("slug, title, body, updated_at").eq("slug", slug).maybeSingle();
  return data as { slug: string; title: string; body: string; updated_at: string } | null;
});
