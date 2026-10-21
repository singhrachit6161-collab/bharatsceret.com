import { describe, expect, it } from "vitest";
import { addLine, cartCount, parseCart, serializeCart, setLine } from "@/lib/cart";
import { discountPercent, formatINR, paiseToRupeesString, rupeesToPaise } from "@/lib/money";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("cart cookie", () => {
  it("round-trips and merges duplicate lines", () => {
    const raw = JSON.stringify([{ v: A, q: 2 }, { v: A, q: 3 }, { v: B, q: 1 }]);
    expect(parseCart(raw)).toEqual([
      { variantId: A, quantity: 5 },
      { variantId: B, quantity: 1 },
    ]);
    expect(parseCart(serializeCart(parseCart(raw)))).toEqual(parseCart(raw));
  });

  it("rejects tampered or malformed cookies, including price injection", () => {
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart(JSON.stringify([{ v: "x", q: 1 }]))).toEqual([]);
    expect(parseCart(JSON.stringify([{ v: A, q: -1 }]))).toEqual([]);
    expect(parseCart(JSON.stringify([{ v: A, q: 1, price: 1 }]))).toEqual([{ variantId: A, quantity: 1 }]);
  });

  it("adds, updates and removes lines", () => {
    let lines = addLine([], A, 2);
    lines = addLine(lines, A, 1);
    lines = addLine(lines, B, 1);
    expect(cartCount(lines)).toBe(4);
    lines = setLine(lines, A, 0);
    expect(lines).toEqual([{ variantId: B, quantity: 1 }]);
    expect(setLine(lines, B, 1000)[0].quantity).toBe(100);
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
