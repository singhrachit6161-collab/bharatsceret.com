import "server-only";
import { serverEnv } from "@/lib/server-env";

/**
 * Minimal Shiprocket API client (https://apiv2.shiprocket.in/v1/external).
 * Credentials are an API user's email + password (Shiprocket → Settings → API);
 * the bearer token is cached in memory and refreshed on expiry or a 401.
 */
const BASE = "https://apiv2.shiprocket.in/v1/external";
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // tokens last 10 days

let cached: { token: string; expires: number } | null = null;

export class ShiprocketError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export function isShiprocketConfigured(): boolean {
  return Boolean(serverEnv.shiprocketEmail && serverEnv.shiprocketPassword && serverEnv.shiprocketPickupLocation && /^[1-9][0-9]{5}$/.test(serverEnv.shiprocketPickupPincode));
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: serverEnv.shiprocketEmail, password: serverEnv.shiprocketPassword }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !body.token) throw new ShiprocketError(`Shiprocket login failed${body.message ? `: ${body.message}` : ""}`, res.status);
  cached = { token: body.token, expires: Date.now() + TOKEN_TTL_MS };
  return body.token;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
  if (!isShiprocketConfigured()) throw new ShiprocketError("Shiprocket is not configured.");
  const token = cached && cached.expires > Date.now() ? cached.token : await login();
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 && !retried) {
    cached = null;
    return call<T>(path, init, true);
  }
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new ShiprocketError(body?.message ? String(body.message) : `Shiprocket request failed (HTTP ${res.status})`, res.status);
  return body;
}

export interface CourierOption {
  courierId: number;
  name: string;
  ratePaise: number;
  etaDays: number | null;
  cod: boolean;
}

export async function getServiceability(args: { deliveryPincode: string; weightKg: number; cod: boolean }): Promise<CourierOption[]> {
  const q = new URLSearchParams({
    pickup_postcode: serverEnv.shiprocketPickupPincode,
    delivery_postcode: args.deliveryPincode,
    weight: String(Math.max(0.1, Math.round(args.weightKg * 100) / 100)),
    cod: args.cod ? "1" : "0",
  });
  const body = await call<{ data?: { available_courier_companies?: Record<string, unknown>[] } }>(`/courier/serviceability/?${q}`);
  return (body.data?.available_courier_companies ?? []).map((c) => ({
    courierId: Number(c.courier_company_id),
    name: String(c.courier_name ?? "Courier"),
    ratePaise: Math.round(Number(c.rate ?? 0) * 100),
    etaDays: Number.isFinite(Number(c.estimated_delivery_days)) ? Number(c.estimated_delivery_days) : null,
    cod: Number(c.cod) === 1,
  }));
}

export interface ShiprocketOrderInput {
  orderNumber: string;
  orderDate: Date;
  paymentMethod: "razorpay" | "cod";
  address: { full_name: string; phone: string; line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; pincode: string };
  email: string | null;
  items: { name: string; sku: string; units: number; unitPricePaise: number }[];
  shippingPaise: number;
  codFeePaise: number;
  discountPaise: number;
  /** Package, in cm and kg. */
  length: number;
  breadth: number;
  height: number;
  weightKg: number;
}

const rupees = (paise: number) => Math.round(paise) / 100;

/** Shiprocket's own order + shipment. COD collectable = sub_total + shipping + transaction charges − discount = our order total. */
export function shiprocketOrderPayload(o: ShiprocketOrderInput) {
  const ist = new Date(o.orderDate.getTime() + 330 * 60_000).toISOString(); // UTC+05:30
  const [first, ...rest] = o.address.full_name.trim().split(/\s+/);
  return {
    order_id: o.orderNumber,
    order_date: `${ist.slice(0, 10)} ${ist.slice(11, 16)}`,
    pickup_location: serverEnv.shiprocketPickupLocation,
    billing_customer_name: first,
    billing_last_name: rest.join(" "),
    billing_address: o.address.line1,
    billing_address_2: [o.address.line2, o.address.landmark].filter(Boolean).join(", "),
    billing_city: o.address.city,
    billing_pincode: o.address.pincode,
    billing_state: o.address.state,
    billing_country: "India",
    billing_email: o.email ?? "",
    billing_phone: o.address.phone,
    shipping_is_billing: true,
    order_items: o.items.map((i) => ({ name: i.name.slice(0, 200), sku: i.sku, units: i.units, selling_price: rupees(i.unitPricePaise) })),
    payment_method: o.paymentMethod === "cod" ? "COD" : "Prepaid",
    shipping_charges: rupees(o.shippingPaise),
    transaction_charges: rupees(o.codFeePaise),
    total_discount: rupees(o.discountPaise),
    sub_total: rupees(o.items.reduce((n, i) => n + i.unitPricePaise * i.units, 0)),
    length: o.length,
    breadth: o.breadth,
    height: o.height,
    weight: Math.max(0.1, Math.round(o.weightKg * 100) / 100),
  };
}

export async function createShiprocketOrder(input: ShiprocketOrderInput): Promise<{ orderId: string; shipmentId: string }> {
  const body = await call<{ order_id?: number | string; shipment_id?: number | string; message?: string }>("/orders/create/adhoc", {
    method: "POST",
    body: shiprocketOrderPayload(input),
  });
  if (!body.order_id || !body.shipment_id) throw new ShiprocketError(body.message ?? "Shiprocket did not return a shipment.");
  return { orderId: String(body.order_id), shipmentId: String(body.shipment_id) };
}

export async function assignAwb(shipmentId: string, courierId?: number): Promise<{ awb: string; courierName: string; courierId: string }> {
  const body = await call<{ awb_assign_status?: number; message?: string; response?: { data?: { awb_code?: string; courier_name?: string; courier_company_id?: number | string } } }>(
    "/courier/assign/awb",
    { method: "POST", body: { shipment_id: Number(shipmentId), ...(courierId ? { courier_id: courierId } : {}) } },
  );
  const d = body.response?.data;
  if (body.awb_assign_status !== 1 || !d?.awb_code) throw new ShiprocketError(body.message ?? "No courier could be assigned for this shipment.");
  return { awb: String(d.awb_code), courierName: String(d.courier_name ?? "Courier"), courierId: String(d.courier_company_id ?? "") };
}

export async function schedulePickup(shipmentId: string): Promise<void> {
  await call("/courier/generate/pickup", { method: "POST", body: { shipment_id: [Number(shipmentId)] } });
}

export async function generateLabel(shipmentId: string): Promise<string | null> {
  const body = await call<{ label_url?: string }>("/courier/generate/label", { method: "POST", body: { shipment_id: [Number(shipmentId)] } });
  return body.label_url && /^https:\/\//.test(body.label_url) ? body.label_url : null;
}

export function trackingUrl(awb: string): string {
  return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
}

type ShipmentStatus = "packed" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "rto" | "cancelled";

/** Map a Shiprocket status label to our shipment status. Unknown labels return null (ignored). */
export function mapShiprocketStatus(label: string | null | undefined): ShipmentStatus | null {
  const s = String(label ?? "").trim().toUpperCase().replace(/[_-]+/g, " ");
  if (!s) return null;
  if (s.startsWith("RTO") || s.includes("RETURN")) return "rto";
  if (s.includes("CANCEL")) return "cancelled";
  if (s.includes("UNDELIVERED") || s.includes("FAILED DELIVERY") || s.includes("NDR")) return "in_transit";
  if (s.includes("OUT FOR DELIVERY")) return "out_for_delivery";
  if (s === "DELIVERED") return "delivered";
  if (s.includes("PICKUP") || s.includes("AWB ASSIGNED") || s.includes("LABEL") || s.includes("MANIFEST") || s === "NEW" || s.includes("READY TO SHIP")) return "packed";
  if (s === "PICKED UP" || s === "SHIPPED") return "shipped";
  if (s.includes("TRANSIT") || s.includes("HUB") || s.includes("REACHED") || s.includes("DELAY") || s.includes("MISROUTED")) return "in_transit";
  return null;
}

/** Parse Shiprocket timestamps ("2026-10-23 14:05:00" or "23 10 2026 14:05:00", IST). */
export function parseShiprocketTime(value: unknown): string | null {
  const v = String(value ?? "").trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}+05:30`).toISOString();
  m = v.match(/^(\d{2}) (\d{2}) (\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] ?? "00"}+05:30`).toISOString();
  return null;
}
