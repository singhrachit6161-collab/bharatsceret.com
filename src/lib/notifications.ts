import "server-only";
import { publicEnv } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { serverEnv } from "@/lib/server-env";

/**
 * Notification abstraction. Sends through a Resend-compatible HTTP API when
 * EMAIL_PROVIDER_API_KEY and EMAIL_FROM are configured. Otherwise it logs that
 * the message was NOT sent (development fallback) and returns { sent: false }.
 * Password recovery emails are sent by Supabase Auth, not by this module.
 */
export type NotificationKind =
  | "order_confirmed"
  | "payment_confirmed"
  | "payment_failed"
  | "order_dispatched"
  | "tracking_update"
  | "order_delivered"
  | "order_cancelled"
  | "refund_update";

export interface NotificationPayload {
  to: string | null;
  orderNumber: string;
  totalPaise?: number;
  trackingUrl?: string | null;
  note?: string | null;
}

const SUBJECTS: Record<NotificationKind, (p: NotificationPayload) => string> = {
  order_confirmed: (p) => `Order ${p.orderNumber} confirmed`,
  payment_confirmed: (p) => `Payment received for order ${p.orderNumber}`,
  payment_failed: (p) => `Payment for order ${p.orderNumber} was not completed`,
  order_dispatched: (p) => `Order ${p.orderNumber} has been dispatched`,
  tracking_update: (p) => `Update on order ${p.orderNumber}`,
  order_delivered: (p) => `Order ${p.orderNumber} delivered`,
  order_cancelled: (p) => `Order ${p.orderNumber} cancelled`,
  refund_update: (p) => `Refund update for order ${p.orderNumber}`,
};

function body(kind: NotificationKind, p: NotificationPayload): string {
  const link = `${publicEnv.siteUrl}/account/orders/${encodeURIComponent(p.orderNumber)}`;
  const lines = [
    SUBJECTS[kind](p) + ".",
    p.totalPaise !== undefined ? `Order total: ${formatINR(p.totalPaise)}` : "",
    p.trackingUrl ? `Track your shipment: ${p.trackingUrl}` : "",
    p.note ?? "",
    `View your order: ${link}`,
    "",
    "— Bharat Secret",
  ];
  return lines.filter((l, i) => l || i === lines.length - 2).join("\n");
}

function mask(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}***@${d ?? ""}`;
}

export async function notify(kind: NotificationKind, payload: NotificationPayload): Promise<{ sent: boolean }> {
  if (!payload.to) return { sent: false };
  if (!serverEnv.emailProviderApiKey || !serverEnv.emailFrom) {
    console.info(`[notify:disabled] NOT sent "${kind}" for ${payload.orderNumber} to ${mask(payload.to)} (email provider not configured)`);
    return { sent: false };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${serverEnv.emailProviderApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: serverEnv.emailFrom, to: [payload.to], subject: SUBJECTS[kind](payload), text: body(kind, payload) }),
    });
    if (!res.ok) {
      console.error(`[notify] provider rejected "${kind}" for ${payload.orderNumber}: HTTP ${res.status}`);
      return { sent: false };
    }
    return { sent: true };
  } catch {
    console.error(`[notify] failed to send "${kind}" for ${payload.orderNumber}`);
    return { sent: false };
  }
}
