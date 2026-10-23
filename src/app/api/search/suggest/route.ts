import { NextResponse, type NextRequest } from "next/server";
import { searchSuggestions } from "@/lib/data/catalog";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  if (!rateLimit(`suggest:${await clientIp()}`, 60, 60_000)) {
    return NextResponse.json({ items: [] }, { status: 429 });
  }
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const items = await searchSuggestions(q);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=60" } });
}
