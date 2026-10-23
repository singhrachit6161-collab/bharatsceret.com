import { INDIAN_STATES } from "@/lib/validation";

/**
 * GST invoice computation (pure; no I/O). Catalogue prices are GST-inclusive,
 * so each line's taxable value is backed out of the price actually charged:
 *   taxable = round(net × 100 / (100 + rate)),  tax = net − taxable
 * The order discount is spread over product lines in proportion to their value.
 * Shipping and COD charges are billed as part of a composite supply at the rate
 * (and HSN) of the principal supply — the highest-value product line.
 * Intra-state supply → CGST + SGST (half each); inter-state → IGST.
 * A seller who is not GST-registered issues a Bill of Supply with no tax.
 * Have your accountant confirm HSN codes, rates and this treatment.
 */

/** GST state codes (first two digits of a GSTIN). */
export const GST_STATE_CODES: Record<(typeof INDIAN_STATES)[number], string> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  Sikkim: "11",
  "Arunachal Pradesh": "12",
  Nagaland: "13",
  Manipur: "14",
  Mizoram: "15",
  Tripura: "16",
  Meghalaya: "17",
  Assam: "18",
  "West Bengal": "19",
  Jharkhand: "20",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Lakshadweep: "31",
  Kerala: "32",
  "Tamil Nadu": "33",
  Puducherry: "34",
  "Andaman and Nicobar Islands": "35",
  Telangana: "36",
  "Andhra Pradesh": "37",
  Ladakh: "38",
};

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40] as const;

export interface BusinessSettings {
  gst_registered: boolean;
  legal_name: string;
  gstin: string;
  address: string;
  state: string;
  state_code: string;
  invoice_prefix: string;
}

export interface InvoiceInputLine {
  name: string;
  sku: string;
  hsn: string | null;
  gstRate: number | null;
  quantity: number;
  /** Amount charged for the line, GST included (unit price × quantity). */
  grossPaise: number;
}

export interface InvoiceInput {
  business: BusinessSettings;
  brandName: string;
  order: {
    orderNumber: string;
    orderDate: string;
    paymentMethod: "razorpay" | "cod";
    discountPaise: number;
    shippingPaise: number;
    codFeePaise: number;
    totalPaise: number;
    email: string | null;
    address: { full_name: string; phone: string; line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; pincode: string };
  };
  lines: InvoiceInputLine[];
}

export interface InvoiceLine {
  description: string;
  sku: string | null;
  hsn: string | null;
  quantity: number;
  gross_paise: number;
  discount_paise: number;
  taxable_paise: number;
  rate: number | null;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
}

export interface InvoiceDocument {
  document_type: "tax_invoice" | "bill_of_supply";
  seller: { name: string; legal_name: string; gstin: string | null; address: string; state: string; state_code: string | null };
  buyer: { name: string; phone: string; email: string | null; address: string; state: string; state_code: string | null; order_number: string; order_date: string; payment_method: string };
  place_of_supply: string;
  intra_state: boolean;
  lines: InvoiceLine[];
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
}

export class InvoiceSetupError extends Error {}

/** Split `amount` across `weights` proportionally, exactly (largest remainder). */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (amount === 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const out = raw.map(Math.floor);
  let rest = amount - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]] += 1;
  return out;
}

function taxSplit(net: number, rate: number, intra: boolean) {
  const taxable = Math.round((net * 100) / (100 + rate));
  const tax = net - taxable;
  if (!intra) return { taxable, cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2);
  return { taxable, cgst, sgst: tax - cgst, igst: 0 };
}

export function buildInvoice(input: InvoiceInput): InvoiceDocument {
  const { business: b, order: o } = input;
  if (!input.lines.length) throw new InvoiceSetupError("The order has no items.");
  const productGross = input.lines.reduce((n, l) => n + l.grossPaise, 0);
  if (productGross - o.discountPaise + o.shippingPaise + o.codFeePaise !== o.totalPaise) {
    throw new InvoiceSetupError("Order amounts do not add up; the invoice cannot be issued.");
  }

  const registered = b.gst_registered;
  if (registered) {
    if (!GSTIN_PATTERN.test(b.gstin)) throw new InvoiceSetupError("Add a valid GSTIN in Admin → Settings → Business & GST.");
    if (!b.legal_name.trim() || !b.address.trim()) throw new InvoiceSetupError("Add the registered business name and address in Admin → Settings → Business & GST.");
    const missing = input.lines.filter((l) => !l.hsn || l.gstRate === null).map((l) => l.name);
    if (missing.length) throw new InvoiceSetupError(`Set the HSN code and GST rate for: ${[...new Set(missing)].join(", ")}.`);
  }

  const buyerState = o.address.state;
  const buyerCode = GST_STATE_CODES[buyerState as keyof typeof GST_STATE_CODES] ?? null;
  const sellerCode = registered ? b.gstin.slice(0, 2) : b.state_code || null;
  const intra = !registered || (buyerCode !== null && buyerCode === sellerCode);

  const discounts = allocate(o.discountPaise, input.lines.map((l) => l.grossPaise));
  const lines: InvoiceLine[] = input.lines.map((l, i) => {
    const net = l.grossPaise - discounts[i];
    const t = registered ? taxSplit(net, l.gstRate!, intra) : { taxable: net, cgst: 0, sgst: 0, igst: 0 };
    return {
      description: l.name,
      sku: l.sku,
      hsn: l.hsn,
      quantity: l.quantity,
      gross_paise: l.grossPaise,
      discount_paise: discounts[i],
      taxable_paise: t.taxable,
      rate: registered ? l.gstRate : null,
      cgst_paise: t.cgst,
      sgst_paise: t.sgst,
      igst_paise: t.igst,
      total_paise: net,
    };
  });

  const principal = input.lines.reduce((best, l) => (l.grossPaise > best.grossPaise ? l : best), input.lines[0]);
  for (const [label, amount] of [
    ["Shipping & handling", o.shippingPaise],
    ["Cash on delivery charge", o.codFeePaise],
  ] as const) {
    if (amount <= 0) continue;
    const t = registered ? taxSplit(amount, principal.gstRate!, intra) : { taxable: amount, cgst: 0, sgst: 0, igst: 0 };
    lines.push({
      description: label,
      sku: null,
      hsn: registered ? principal.hsn : null,
      quantity: 1,
      gross_paise: amount,
      discount_paise: 0,
      taxable_paise: t.taxable,
      rate: registered ? principal.gstRate : null,
      cgst_paise: t.cgst,
      sgst_paise: t.sgst,
      igst_paise: t.igst,
      total_paise: amount,
    });
  }

  const sum = (k: keyof InvoiceLine) => lines.reduce((n, l) => n + (l[k] as number), 0);
  const address = [o.address.line1, o.address.line2, o.address.landmark, `${o.address.city}, ${o.address.state} ${o.address.pincode}`].filter(Boolean).join(", ");
  return {
    document_type: registered ? "tax_invoice" : "bill_of_supply",
    seller: {
      name: input.brandName,
      legal_name: b.legal_name.trim() || input.brandName,
      gstin: registered ? b.gstin : null,
      address: b.address.trim(),
      state: b.state,
      state_code: sellerCode,
    },
    buyer: {
      name: o.address.full_name,
      phone: o.address.phone,
      email: o.email,
      address,
      state: buyerState,
      state_code: buyerCode,
      order_number: o.orderNumber,
      order_date: o.orderDate,
      payment_method: o.paymentMethod === "cod" ? "Cash on delivery" : "Prepaid (online)",
    },
    place_of_supply: buyerCode ? `${buyerState} (${buyerCode})` : buyerState,
    intra_state: intra,
    lines,
    taxable_paise: sum("taxable_paise"),
    cgst_paise: sum("cgst_paise"),
    sgst_paise: sum("sgst_paise"),
    igst_paise: sum("igst_paise"),
    total_paise: sum("total_paise"),
  };
}

/** Indian-English amount in words, e.g. 123456 paise → "One Thousand Two Hundred Thirty Four Rupees and Fifty Six Paise". */
export function amountInWords(paise: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`);
  const three = (n: number) => [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : "", two(n % 100)].filter(Boolean).join(" ");
  const words = (n: number): string => {
    if (n === 0) return "Zero";
    const parts: string[] = [];
    const crore = Math.floor(n / 1e7);
    const lakh = Math.floor((n % 1e7) / 1e5);
    const thousand = Math.floor((n % 1e5) / 1e3);
    const rest = n % 1e3;
    if (crore) parts.push(`${words(crore)} Crore`);
    if (lakh) parts.push(`${two(lakh)} Lakh`);
    if (thousand) parts.push(`${two(thousand)} Thousand`);
    if (rest) parts.push(three(rest));
    return parts.join(" ");
  };
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `${words(rupees)} Rupees${p ? ` and ${two(p)} Paise` : ""} Only`;
}
