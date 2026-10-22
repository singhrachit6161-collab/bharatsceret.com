/** Pure rules for Build Your Own Hamper (shared by the builder UI and the server action). */

export interface HamperRules {
  capacity: number;
  minItems: number;
}

export interface HamperItemCheck {
  variantId: string;
  quantity: number;
  /** Units available to sell right now (on hand − reserved). */
  available: number;
  maxPerOrder: number;
  eligible: boolean;
}

export function hamperUnits(items: { quantity: number }[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

/** Returns a customer-facing problem, or null when the hamper is valid. */
export function validateHamper(rules: HamperRules, items: HamperItemCheck[]): string | null {
  const units = hamperUnits(items);
  const min = Math.min(Math.max(1, rules.minItems), rules.capacity);
  if (units < min) return `Add at least ${min} items to your hamper.`;
  if (units > rules.capacity) return `This box holds ${rules.capacity} items — remove ${units - rules.capacity} to continue.`;
  if (new Set(items.map((i) => i.variantId)).size !== items.length) return "Your hamper has duplicate items. Please refresh and try again.";
  for (const i of items) {
    if (!Number.isInteger(i.quantity) || i.quantity < 1) return "Invalid quantity in your hamper.";
    if (!i.eligible) return "One of the selected items can't be added to a hamper.";
    if (i.quantity > Math.min(i.available, i.maxPerOrder)) return "One of the selected items doesn't have enough stock.";
  }
  return null;
}
