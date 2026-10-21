import { z } from "zod";

/**
 * The cart cookie stores ONLY variant ids and quantities. Prices, names and
 * availability are always loaded from the database on the server.
 */
export const CART_COOKIE = "sv_cart";
export const MAX_CART_LINES = 30;
export const MAX_LINE_QTY = 100;

const lineSchema = z.object({
  v: z.uuid(),
  q: z.number().int().min(1).max(MAX_LINE_QTY),
});
const cartSchema = z.array(lineSchema).max(MAX_CART_LINES);

export interface CartLine {
  variantId: string;
  quantity: number;
}

export function parseCart(raw: string | undefined | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const merged = new Map<string, number>();
    for (const l of parsed.data) merged.set(l.v, Math.min(MAX_LINE_QTY, (merged.get(l.v) ?? 0) + l.q));
    return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify(lines.slice(0, MAX_CART_LINES).map((l) => ({ v: l.variantId, q: l.quantity })));
}

export function setLine(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  const q = Math.max(0, Math.min(MAX_LINE_QTY, Math.floor(quantity)));
  const rest = lines.filter((l) => l.variantId !== variantId);
  if (q === 0) return rest;
  const existingIndex = lines.findIndex((l) => l.variantId === variantId);
  const next = { variantId, quantity: q };
  if (existingIndex === -1) return [...rest, next].slice(0, MAX_CART_LINES);
  const copy = [...lines];
  copy[existingIndex] = next;
  return copy;
}

export function addLine(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  const existing = lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
  return setLine(lines, variantId, existing + quantity);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}
