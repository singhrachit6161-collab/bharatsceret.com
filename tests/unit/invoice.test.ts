import { describe, expect, it } from "vitest";
import { allocate, amountInWords, buildInvoice, InvoiceSetupError, type InvoiceInput } from "@/lib/invoice";

const business = { gst_registered: true, legal_name: "Bharat Secrets Pvt Ltd", gstin: "27ABCDE1234F1Z5", address: "1 Market Road, Pune", state: "Maharashtra", state_code: "27", invoice_prefix: "BS" };
const address = { full_name: "Asha Rao", phone: "9876543210", line1: "12 Hill Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

function input(over: Partial<InvoiceInput["order"]> = {}, lines?: InvoiceInput["lines"], biz = business): InvoiceInput {
  const l = lines ?? [
    { name: "Almonds (500 g)", sku: "ALM-500", hsn: "0802", gstRate: 5, quantity: 2, grossPaise: 105000 },
    { name: "Saffron (1 g)", sku: "SAF-1", hsn: "0910", gstRate: 5, quantity: 1, grossPaise: 52500 },
  ];
  const gross = l.reduce((n, x) => n + x.grossPaise, 0);
  const o = { orderNumber: "BS261023-1001", orderDate: "2026-10-23T10:00:00Z", paymentMethod: "razorpay" as const, discountPaise: 0, shippingPaise: 0, codFeePaise: 0, email: "a@example.test", address, ...over };
  return { business: biz, brandName: "Bharat Secrets", order: { ...o, totalPaise: over.totalPaise ?? gross - o.discountPaise + o.shippingPaise + o.codFeePaise }, lines: l };
}

describe("allocate", () => {
  it("splits exactly and proportionally", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [3000, 1000])).toEqual([750, 250]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
    const parts = allocate(9999, [12345, 67, 8901]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(9999);
  });
});

describe("buildInvoice", () => {
  it("splits CGST/SGST for intra-state supply and backs tax out of inclusive prices", () => {
    const doc = buildInvoice(input());
    expect(doc.document_type).toBe("tax_invoice");
    expect(doc.intra_state).toBe(true);
    expect(doc.igst_paise).toBe(0);
    const almonds = doc.lines[0];
    expect(almonds.taxable_paise).toBe(100000); // 1050 incl. 5% → 1000 + 50
    expect(almonds.cgst_paise + almonds.sgst_paise).toBe(5000);
    expect(doc.total_paise).toBe(157500);
    expect(doc.taxable_paise + doc.cgst_paise + doc.sgst_paise).toBe(doc.total_paise);
  });

  it("uses IGST for inter-state supply", () => {
    const doc = buildInvoice(input({ address: { ...address, state: "Karnataka" } }));
    expect(doc.intra_state).toBe(false);
    expect(doc.cgst_paise + doc.sgst_paise).toBe(0);
    expect(doc.igst_paise).toBe(7500);
    expect(doc.place_of_supply).toBe("Karnataka (29)");
  });

  it("spreads the discount and bills shipping/COD at the principal supply's rate", () => {
    const lines = [
      { name: "Gift tin", sku: "TIN", hsn: "7310", gstRate: 18, quantity: 1, grossPaise: 20000 },
      { name: "Almonds", sku: "ALM", hsn: "0802", gstRate: 5, quantity: 1, grossPaise: 80000 },
    ];
    const doc = buildInvoice(input({ discountPaise: 10000, shippingPaise: 6900, codFeePaise: 4900, paymentMethod: "cod" }, lines));
    expect(doc.lines.map((l) => l.discount_paise)).toEqual([2000, 8000, 0, 0]);
    const shipping = doc.lines[2];
    expect(shipping.description).toBe("Shipping & handling");
    expect(shipping.rate).toBe(5);
    expect(shipping.hsn).toBe("0802");
    expect(doc.total_paise).toBe(100000 - 10000 + 6900 + 4900);
  });

  it("issues a bill of supply without tax when not GST registered", () => {
    const doc = buildInvoice(input({}, [{ name: "Dates", sku: "DAT", hsn: null, gstRate: null, quantity: 1, grossPaise: 50000 }], { ...business, gst_registered: false, gstin: "" }));
    expect(doc.document_type).toBe("bill_of_supply");
    expect(doc.lines[0]).toMatchObject({ taxable_paise: 50000, rate: null, cgst_paise: 0, igst_paise: 0 });
    expect(doc.seller.gstin).toBeNull();
  });

  it("refuses to invent tax data", () => {
    expect(() => buildInvoice(input({}, [{ name: "Dates", sku: "DAT", hsn: null, gstRate: 5, quantity: 1, grossPaise: 50000 }]))).toThrow(/HSN code and GST rate for: Dates/);
    expect(() => buildInvoice(input({}, undefined, { ...business, gstin: "BAD" }))).toThrow(InvoiceSetupError);
    expect(() => buildInvoice(input({ totalPaise: 1 }))).toThrow(/do not add up/);
  });
});

describe("amountInWords", () => {
  it("uses the Indian numbering system", () => {
    expect(amountInWords(157500)).toBe("One Thousand Five Hundred Seventy Five Rupees Only");
    expect(amountInWords(1234567899)).toBe("One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees and Ninety Nine Paise Only");
    expect(amountInWords(5)).toBe("Zero Rupees and Five Paise Only");
  });
});
