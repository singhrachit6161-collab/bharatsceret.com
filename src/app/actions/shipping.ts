"use server";

import { getSettings } from "@/lib/data/settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getShippingProvider, type ServiceabilityResult } from "@/lib/shipping";
import { pincodeSchema } from "@/lib/validation";

export async function checkPincode(pincode: string): Promise<ServiceabilityResult | { error: string }> {
  const parsed = pincodeSchema.safeParse(pincode);
  if (!parsed.success) return { error: "Enter a valid 6-digit PIN code." };
  if (!rateLimit(`pincode:${await clientIp()}`, 30, 60_000)) return { error: "Too many checks. Please wait a minute." };
  return getShippingProvider().checkServiceability(parsed.data, await getSettings());
}
