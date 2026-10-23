import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isServiceRoleConfigured, serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Records a de-duplicated product view. No user id or IP is stored: only a
 * salted hash that rotates daily, used to count one view per visitor per day.
 */
export async function POST(request: NextRequest) {
  const body = z.object({ productId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = await clientIp();
  if (!rateLimit(`view:${ip}`, 120, 60_000)) return NextResponse.json({ ok: false }, { status: 429 });
  if (!isServiceRoleConfigured() || !serverEnv.viewHashSalt) return NextResponse.json({ ok: false, reason: "disabled" });

  const day = new Date().toISOString().slice(0, 10);
  const ua = request.headers.get("user-agent") ?? "";
  const sessionHash = createHash("sha256").update(`${serverEnv.viewHashSalt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);
  // Service role: view events are not writable by clients (prevents count inflation via direct API calls).
  await createServiceClient().rpc("record_product_view", { p_product_id: body.data.productId, p_session_hash: sessionHash });
  return NextResponse.json({ ok: true });
}
