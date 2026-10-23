import { describe, expect, it } from "vitest";
import { returnDaysLeft } from "@/lib/returns";

describe("returnDaysLeft", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  it("counts down from delivery", () => {
    expect(returnDaysLeft({ status: "delivered", delivered_at: "2026-10-22T12:00:00Z" }, 7, now)).toBe(6);
    expect(returnDaysLeft({ status: "delivered", delivered_at: "2026-10-16T13:00:00Z" }, 7, now)).toBe(1);
  });
  it("is null once the window closes or before delivery", () => {
    expect(returnDaysLeft({ status: "delivered", delivered_at: "2026-10-15T12:00:00Z" }, 7, now)).toBeNull();
    expect(returnDaysLeft({ status: "shipped", delivered_at: null }, 7, now)).toBeNull();
    expect(returnDaysLeft({ status: "cancelled", delivered_at: "2026-10-22T12:00:00Z" }, 7, now)).toBeNull();
  });
});
