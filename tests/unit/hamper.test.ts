import { describe, expect, it } from "vitest";
import { validateHamper, type HamperItemCheck } from "@/lib/hamper";

const item = (variantId: string, quantity: number, over: Partial<HamperItemCheck> = {}): HamperItemCheck => ({
  variantId, quantity, available: 50, maxPerOrder: 10, eligible: true, ...over,
});

describe("validateHamper", () => {
  const rules = { capacity: 4, minItems: 2 };
  it("accepts a hamper within limits", () => {
    expect(validateHamper(rules, [item("a", 1), item("b", 3)])).toBeNull();
  });
  it("enforces minimum and capacity", () => {
    expect(validateHamper(rules, [item("a", 1)])).toMatch(/at least 2/);
    expect(validateHamper(rules, [item("a", 3), item("b", 2)])).toMatch(/holds 4 items/);
    expect(validateHamper({ capacity: 1, minItems: 2 }, [item("a", 1)])).toBeNull();
  });
  it("rejects duplicates, ineligible items and short stock", () => {
    expect(validateHamper(rules, [item("a", 1), item("a", 1)])).toMatch(/duplicate/);
    expect(validateHamper(rules, [item("a", 1), item("b", 1, { eligible: false })])).toMatch(/can't be added/);
    expect(validateHamper(rules, [item("a", 1), item("b", 2, { available: 1 })])).toMatch(/stock/);
    expect(validateHamper(rules, [item("a", 0), item("b", 2)])).toMatch(/Invalid quantity/);
  });
});
