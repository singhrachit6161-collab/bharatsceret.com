import "server-only";
import Razorpay from "razorpay";
import { isRazorpayConfigured, serverEnv } from "@/lib/server-env";

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!isRazorpayConfigured()) throw new Error("Razorpay is not configured");
  if (!instance) {
    instance = new Razorpay({ key_id: serverEnv.razorpayKeyId, key_secret: serverEnv.razorpayKeySecret });
  }
  return instance;
}

export interface GatewayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
}

/** Authoritative payment state straight from the Razorpay API. */
export async function fetchGatewayPayment(paymentId: string): Promise<GatewayPayment> {
  const p = await getRazorpay().payments.fetch(paymentId);
  return {
    id: p.id,
    order_id: (p.order_id as string | undefined) ?? null,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    method: (p.method as string | undefined) ?? null,
  };
}
