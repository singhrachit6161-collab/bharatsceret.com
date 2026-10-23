import { describe, expect, it } from "vitest";
import {
  addBundle, addLine, aggregateCart, cartCount, cleanText, EMPTY_CART, fitsInCookie, MAX_BUNDLES, parseCart,
  removeBundle, serializeCart, setLine, type CartBundle,
} from "@/lib/cart";
import { discountPercent, formatINR, paiseToRupeesString, rupeesToPaise } from "@/lib/money";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const BOX = "33333333-3333-4333-8333-333333333333";

const hamper = (over: Partial<CartBundle> = {}): CartBundle => ({
  id: "abcdef1234",
  boxVariantId: BOX,
  items: [{ variantId: A, quantity: 2 }, { variantId: B, quantity: 1 }],
  recipient: "Asha",
  message: "Happy Diwali!",
  ...over,
});

describe("cart cookie", () => {
  it("round-trips lines and hampers", () => {
    let s = addLine(EMPTY_CART, A, 2);
    s = addBundle(s, hamper());
    expect(parseCart(serializeCart(s))).toEqual(s);
  });

  it("still reads the legacy v1 format and merges duplicates", () => {
    const raw = JSON.stringify([{ v: A, q: 2 }, { v: A, q: 3 }, { v: B, q: 1 }]);
    expect(parseCart(raw)).toEqual({
      lines: [{ variantId: A, quantity: 5 }, { variantId: B, quantity: 1 }],
      bundles: [],
    });
  });

  it("rejects tampered or malformed cookies, including injected prices", () => {
    expect(parseCart("not json")).toEqual(EMPTY_CART);
    expect(parseCart(JSON.stringify([{ v: "x", q: 1 }]))).toEqual(EMPTY_CART);
    expect(parseCart(JSON.stringify([{ v: A, q: -1 }]))).toEqual(EMPTY_CART);
    expect(parseCart(JSON.stringify([{ v: A, q: 1, price: 1 }]))).toEqual({ lines: [{ variantId: A, quantity: 1 }], bundles: [] });
    const tooMany = { l: [], b: Array.from({ length: MAX_BUNDLES + 1 }, () => ({ i: "abcdef1234", x: BOX, c: [[A, 1]] })) };
    expect(parseCart(Buffer.from(JSON.stringify(tooMany)).toString("base64url"))).toEqual(EMPTY_CART);
  });

  it("cleans gift text from the cookie", () => {
    const raw = Buffer.from(JSON.stringify({ l: [], b: [{ i: "abcdef1234", x: BOX, c: [[A, 1]], m: "  Hi\u0007 there  ", t: "" }] })).toString("base64url");
    const b = parseCart(raw).bundles[0];
    expect(b.message).toBe("Hi there");
    expect(b.recipient).toBeNull();
    expect(cleanText("x".repeat(500), 200)?.length).toBe(200);
  });

  it("adds, updates and removes lines and hampers", () => {
    let s = addLine(EMPTY_CART, A, 2);
    s = addLine(s, A, 1);
    s = addLine(s, B, 1);
    s = addBundle(s, hamper());
    expect(cartCount(s)).toBe(5);
    s = setLine(s, A, 0);
    expect(s.lines).toEqual([{ variantId: B, quantity: 1 }]);
    expect(setLine(s, B, 1000).lines[0].quantity).toBe(100);
    expect(removeBundle(s, "abcdef1234").bundles).toEqual([]);
  });

  it("aggregates standalone lines, boxes and hamper contents per variant", () => {
    let s = addLine(EMPTY_CART, A, 1);
    s = addBundle(s, hamper());
    s = addBundle(s, hamper({ id: "zzzzzz9999", items: [{ variantId: A, quantity: 1 }] }));
    const agg = Object.fromEntries(aggregateCart(s).map((l) => [l.variantId, l.quantity]));
    expect(agg).toEqual({ [A]: 4, [B]: 1, [BOX]: 2 });
  });

  it("knows when the cookie would be too large", () => {
    let s = EMPTY_CART;
    for (let i = 0; i < 30; i++) s = addLine(s, `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`, 1);
    expect(fitsInCookie(s)).toBe(true);
    for (let i = 0; i < 3; i++) {
      s = addBundle(s, hamper({ id: `bundle${i}xyz`, message: "m".repeat(200), items: Array.from({ length: 9 }, (_, k) => ({ variantId: `${String(k).padStart(8, "9")}-1111-4111-8111-111111111111`, quantity: 1 })) }));
    }
    expect(fitsInCookie(s)).toBe(false);
  });
});

describe("money", () => {
  it("formats paise as INR", () => {
    expect(formatINR(32900)).toBe("₹329");
    expect(formatINR(119950)).toBe("₹1,199.5");
  });
  it("parses rupees without floating point error", () => {
    expect(rupeesToPaise("0.29")).toBe(29);
    expect(rupeesToPaise("1199.9")).toBe(119990);
    expect(rupeesToPaise("12.345")).toBeNull();
    expect(rupeesToPaise("-1")).toBeNull();
    expect(paiseToRupeesString(119990)).toBe("1199.90");
    expect(paiseToRupeesString(32900)).toBe("329");
  });
  it("computes discount percentages only for valid compare-at prices", () => {
    expect(discountPercent(32900, 39900)).toBe(18);
    expect(discountPercent(32900, 32900)).toBeNull();
    expect(discountPercent(32900, null)).toBeNull();
  });
});
