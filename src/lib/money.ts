/** Money helpers. All amounts are integer paise (1 INR = 100 paise). */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(paise: number | bigint | string): string {
  const n = typeof paise === "number" ? paise : Number(paise);
  return inr.format(n / 100);
}

/** Parse a rupee string such as "329" or "329.50" into paise without floating-point error. */
export function rupeesToPaise(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function paiseToRupeesString(paise: number): string {
  const whole = Math.floor(paise / 100);
  const frac = paise % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}

export function discountPercent(pricePaise: number, compareAtPaise: number | null | undefined): number | null {
  if (!compareAtPaise || compareAtPaise <= pricePaise) return null;
  return Math.round(((compareAtPaise - pricePaise) / compareAtPaise) * 100);
}
