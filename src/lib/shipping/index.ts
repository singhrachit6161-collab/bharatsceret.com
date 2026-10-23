import "server-only";
import type { StoreSettings } from "@/lib/data/settings";
import { serverEnv } from "@/lib/server-env";
import { getServiceability, isShiprocketConfigured } from "./shiprocket";

/**
 * Shipping abstraction. The "manual" provider uses the store's configured
 * rules (serviceable PIN prefixes, typical delivery window) and staff-entered
 * tracking details. The "shiprocket" provider asks Shiprocket which couriers
 * serve a PIN code and falls back to the manual rules if the API is down.
 */
export interface ServiceabilityResult {
  serviceable: boolean;
  source: "store_rules" | "carrier";
  estimate: { minDays: number; maxDays: number } | null;
  message: string;
}

export interface ShippingProvider {
  name: string;
  checkServiceability(pincode: string, settings: StoreSettings): Promise<ServiceabilityResult>;
}

const manualProvider: ShippingProvider = {
  name: "manual",
  async checkServiceability(pincode, settings) {
    const prefixes = settings.shipping.serviceable_pincode_prefixes ?? [];
    const serviceable = prefixes.length === 0 || prefixes.some((p) => pincode.startsWith(p));
    const { estimated_days_min: min, estimated_days_max: max } = settings.shipping;
    return serviceable
      ? {
          serviceable: true,
          source: "store_rules",
          estimate: { minDays: min, maxDays: max },
          message: `We deliver to ${pincode}. Typical delivery time is ${min}–${max} business days after dispatch.`,
        }
      : {
          serviceable: false,
          source: "store_rules",
          estimate: null,
          message: `Sorry, we do not deliver to ${pincode} yet.`,
        };
  },
};

const shiprocketProvider: ShippingProvider = {
  name: "shiprocket",
  async checkServiceability(pincode, settings) {
    const rules = await manualProvider.checkServiceability(pincode, settings);
    if (!rules.serviceable) return rules; // the store's own exclusions always apply
    try {
      const couriers = await getServiceability({ deliveryPincode: pincode, weightKg: 0.5, cod: false });
      if (!couriers.length) {
        return { serviceable: false, source: "carrier", estimate: null, message: `Sorry, our courier partners do not deliver to ${pincode} yet.` };
      }
      const etas = couriers.map((c) => c.etaDays).filter((d): d is number => d !== null && d > 0);
      if (!etas.length) return { ...rules, source: "carrier" };
      const min = Math.min(...etas);
      const max = Math.max(min, Math.min(Math.max(...etas), min + 4));
      return {
        serviceable: true,
        source: "carrier",
        estimate: { minDays: min, maxDays: max },
        message: `We deliver to ${pincode}. Estimated delivery in ${min === max ? min : `${min}–${max}`} days after dispatch (courier estimate).`,
      };
    } catch (e) {
      console.warn(`[shipping] Shiprocket serviceability failed, using store rules: ${(e as Error).message}`);
      return rules;
    }
  },
};

export function getShippingProvider(): ShippingProvider {
  if (serverEnv.shippingProvider === "shiprocket") {
    if (isShiprocketConfigured()) return shiprocketProvider;
    console.warn("[shipping] SHIPPING_PROVIDER=shiprocket but Shiprocket credentials are incomplete; using manual rules.");
  }
  return manualProvider;
}

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  packed: "Packed",
  shipped: "Shipped",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rto: "Returned to origin",
  cancelled: "Cancelled",
};
