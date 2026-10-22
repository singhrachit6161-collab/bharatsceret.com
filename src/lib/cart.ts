import { z } from "zod";

/**
 * The cart cookie stores ONLY variant ids, quantities and hamper composition.
 * Prices, names and availability are always loaded from the database.
 *
 * Format (v2): base64url(JSON) of
 *   { l: [[variantId, qty], ...],                    // standalone lines
 *     b: [{ i, x: boxVariantId, c: [[variantId, qty], ...], t?: recipient, m?: message }] }
 * The legacy v1 format (a JSON array of {v, q}) is still accepted when reading.
 */
export const CART_COOKIE = "sv_cart";
export const MAX_CART_LINES = 30;
export const MAX_LINE_QTY = 100;
export const MAX_BUNDLES = 3;
export const MAX_BUNDLE_ITEMS = 24;
export const MAX_RECIPIENT = 60;
export const MAX_MESSAGE = 200;
/** Keep the cookie comfortably under the 4 KB browser limit. */
export const MAX_COOKIE_CHARS = 3600;

export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface CartBundle {
  id: string;
  boxVariantId: string;
  items: CartLine[];
  recipient: string | null;
  message: string | null;
}

export interface CartState {
  lines: CartLine[];
  bundles: CartBundle[];
}

export const EMPTY_CART: CartState = { lines: [], bundles: [] };

const uuid = z.uuid();
const qty = z.number().int().min(1).max(MAX_LINE_QTY);
const pair = z.tuple([uuid, qty]);
const v2Schema = z.object({
  l: z.array(pair).max(MAX_CART_LINES).default([]),
  b: z
    .array(
      z.object({
        i: z.string().regex(/^[A-Za-z0-9]{6,16}$/),
        x: uuid,
        c: z.array(pair).min(1).max(MAX_BUNDLE_ITEMS),
        t: z.string().max(MAX_RECIPIENT * 2).optional(),
        m: z.string().max(MAX_MESSAGE * 2).optional(),
      }),
    )
    .max(MAX_BUNDLES)
    .default([]),
});
const v1Schema = z.array(z.object({ v: uuid, q: qty })).max(MAX_CART_LINES);

/** Strip control characters, collapse whitespace and cap length. */
export function cleanText(input: string | null | undefined, max: number): string | null {
  if (!input) return null;
  const s = input
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
  return s || null;
}

function mergeLines(pairs: CartLine[]): CartLine[] {
  const merged = new Map<string, number>();
  for (const l of pairs) merged.set(l.variantId, Math.min(MAX_LINE_QTY, (merged.get(l.variantId) ?? 0) + l.quantity));
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

function decode(raw: string): unknown {
  if (raw.startsWith("[") || raw.startsWith("{")) return JSON.parse(raw);
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
}

export function parseCart(raw: string | undefined | null): CartState {
  if (!raw) return { lines: [], bundles: [] };
  try {
    const data = decode(raw);
    const legacy = v1Schema.safeParse(data);
    if (legacy.success) {
      return { lines: mergeLines(legacy.data.map((l) => ({ variantId: l.v, quantity: l.q }))), bundles: [] };
    }
    const parsed = v2Schema.safeParse(data);
    if (!parsed.success) return { lines: [], bundles: [] };
    return {
      lines: mergeLines(parsed.data.l.map(([variantId, quantity]) => ({ variantId, quantity }))),
      bundles: parsed.data.b.map((b) => ({
        id: b.i,
        boxVariantId: b.x,
        items: mergeLines(b.c.map(([variantId, quantity]) => ({ variantId, quantity }))),
        recipient: cleanText(b.t, MAX_RECIPIENT),
        message: cleanText(b.m, MAX_MESSAGE),
      })),
    };
  } catch {
    return { lines: [], bundles: [] };
  }
}

export function serializeCart(state: CartState): string {
  const json = JSON.stringify({
    l: state.lines.slice(0, MAX_CART_LINES).map((l) => [l.variantId, l.quantity]),
    b: state.bundles.slice(0, MAX_BUNDLES).map((b) => ({
      i: b.id,
      x: b.boxVariantId,
      c: b.items.map((l) => [l.variantId, l.quantity]),
      ...(b.recipient ? { t: b.recipient } : {}),
      ...(b.message ? { m: b.message } : {}),
    })),
  });
  return Buffer.from(json, "utf8").toString("base64url");
}

export function fitsInCookie(state: CartState): boolean {
  return serializeCart(state).length <= MAX_COOKIE_CHARS;
}

export function setLine(state: CartState, variantId: string, quantity: number): CartState {
  const q = Math.max(0, Math.min(MAX_LINE_QTY, Math.floor(quantity)));
  const index = state.lines.findIndex((l) => l.variantId === variantId);
  let lines: CartLine[];
  if (q === 0) lines = state.lines.filter((l) => l.variantId !== variantId);
  else if (index === -1) lines = [...state.lines, { variantId, quantity: q }].slice(0, MAX_CART_LINES);
  else lines = state.lines.map((l, i) => (i === index ? { variantId, quantity: q } : l));
  return { ...state, lines };
}

export function addLine(state: CartState, variantId: string, quantity: number): CartState {
  const existing = state.lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
  return setLine(state, variantId, existing + quantity);
}

export function addBundle(state: CartState, bundle: CartBundle): CartState {
  return { ...state, bundles: [...state.bundles, bundle] };
}

export function removeBundle(state: CartState, id: string): CartState {
  return { ...state, bundles: state.bundles.filter((b) => b.id !== id) };
}

/** Items shown in the header badge: standalone units plus one per hamper. */
export function cartCount(state: CartState): number {
  return state.lines.reduce((n, l) => n + l.quantity, 0) + state.bundles.length;
}

/**
 * Total quantity needed per variant across standalone lines, hamper boxes and
 * hamper contents. This is what is priced, stock-checked and reserved.
 */
export function aggregateCart(state: CartState): CartLine[] {
  const total = new Map<string, number>();
  const add = (id: string, q: number) => total.set(id, (total.get(id) ?? 0) + q);
  for (const l of state.lines) add(l.variantId, l.quantity);
  for (const b of state.bundles) {
    add(b.boxVariantId, 1);
    for (const l of b.items) add(l.variantId, l.quantity);
  }
  return [...total].map(([variantId, quantity]) => ({ variantId, quantity }));
}

export function newBundleId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
