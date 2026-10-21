import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isServiceRoleConfigured, serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Scheduled maintenance (call every 5 minutes with `Authorization: Bearer $CRON_SECRET`):
 *  - expires unpaid online orders and releases their stock reservations
 *  - refreshes product popularity scores
 */
function authorized(request: NextRequest): boolean {
  const secret = serverEnv.cronSecret;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const db = createServiceClient();
  const expired = await db.rpc("expire_pending_orders");
  const popularity = await db.rpc("refresh_product_popularity");
  if (expired.error || popularity.error) {
    return NextResponse.json({ error: "maintenance failed" }, { status: 500 });
  }
  return NextResponse.json({ expiredOrders: expired.data, popularityUpdated: popularity.data });
}

export const GET = run;
export const POST = run;
