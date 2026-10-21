import "server-only";
import type { StoreSettings } from "@/lib/data/settings";
import { serverEnv } from "@/lib/server-env";

/**
 * Shipping abstraction. The "manual" provider uses the store's configured
 * rules (serviceable PIN prefixes, typical delivery window) and staff-entered
 * tracking details. A carrier provider (e.g. Shiprocket) can implement the same
 * interface; until one is configured and implemented, nothing here pretends
 * to talk to a carrier.
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

export function getShippingProvider(): ShippingProvider {
  // Only the manual provider is implemented. Configure SHIPPING_PROVIDER once a
  // carrier integration is built (see docs/SHIPPING.md).
  if (serverEnv.shippingProvider !== "manual") {
    console.warn(`[shipping] Provider "${serverEnv.shippingProvider}" is not implemented; using manual rules.`);
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
