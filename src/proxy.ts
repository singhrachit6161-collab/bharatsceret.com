import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, images and the webhook endpoint (which must receive the raw, untouched request).
    "/((?!_next/static|_next/image|favicon.ico|placeholders/|api/razorpay/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
