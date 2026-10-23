import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-env", () => ({ serverEnv: { shiprocketPickupLocation: "Primary", shiprocketPickupPincode: "411001" } }));
const { mapShiprocketStatus, parseShiprocketTime, shiprocketOrderPayload } = await import("@/lib/shipping/shiprocket");

describe("mapShiprocketStatus", () => {
  it.each([
    ["PICKUP SCHEDULED", "packed"],
    ["AWB ASSIGNED", "packed"],
    ["OUT FOR PICKUP", "packed"],
    ["PICKED UP", "shipped"],
    ["SHIPPED", "shipped"],
    ["IN TRANSIT", "in_transit"],
    ["REACHED AT DESTINATION HUB", "in_transit"],
    ["OUT FOR DELIVERY", "out_for_delivery"],
    ["DELIVERED", "delivered"],
    ["UNDELIVERED", "in_transit"],
    ["RTO INITIATED", "rto"],
    ["RTO DELIVERED", "rto"],
    ["CANCELED", "cancelled"],
    ["something new", null],
    ["", null],
  ])("%s → %s", (label, expected) => {
    expect(mapShiprocketStatus(label)).toBe(expected);
  });
});

describe("parseShiprocketTime", () => {
  it("reads both formats as IST", () => {
    expect(parseShiprocketTime("2026-10-23 14:05:00")).toBe("2026-10-23T08:35:00.000Z");
    expect(parseShiprocketTime("23 10 2026 14:05:00")).toBe("2026-10-23T08:35:00.000Z");
    expect(parseShiprocketTime("yesterday")).toBeNull();
  });
});

describe("shiprocketOrderPayload", () => {
  it("makes Shiprocket's COD total equal the order total", () => {
    const p = shiprocketOrderPayload({
      orderNumber: "BS261023-1001",
      orderDate: new Date("2026-10-23T04:30:00Z"),
      paymentMethod: "cod",
      address: { full_name: "Asha Devi Rao", phone: "9876543210", line1: "12 Hill Road", line2: "Flat 4", city: "Pune", state: "Maharashtra", pincode: "411001" },
      email: null,
      items: [
        { name: "Almonds (500 g)", sku: "ALM-500", units: 2, unitPricePaise: 52500 },
        { name: "Saffron (1 g)", sku: "SAF-1", units: 1, unitPricePaise: 49900 },
      ],
      shippingPaise: 6900,
      codFeePaise: 4900,
      discountPaise: 10000,
      length: 20,
      breadth: 15,
      height: 10,
      weightKg: 1.234,
    });
    expect(p.payment_method).toBe("COD");
    expect(p.order_date).toBe("2026-10-23 10:00");
    expect(p.billing_customer_name).toBe("Asha");
    expect(p.billing_last_name).toBe("Devi Rao");
    expect(p.weight).toBe(1.23);
    const collectable = p.sub_total + p.shipping_charges + p.transaction_charges - p.total_discount;
    expect(Math.round(collectable * 100)).toBe(105000 + 49900 + 6900 + 4900 - 10000);
  });
});
