import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay-signature";
import { processRazorpayWebhook, type WebhookDeps } from "@/lib/razorpay-webhook";

const SECRET = "test_key_secret";
const WH = "test_webhook_secret";

describe("checkout signature", () => {
  const sig = createHmac("sha256", SECRET).update("order_ABC|pay_XYZ").digest("hex");
  it("accepts a valid signature", () => {
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: sig }, SECRET)).toBe(true);
  });
  it("rejects tampered ids, wrong secret, malformed or empty signatures", () => {
    expect(verifyCheckoutSignature({ orderId: "order_ABD", paymentId: "pay_XYZ", signature: sig }, SECRET)).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: sig }, "other")).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: "zz" }, SECRET)).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: sig.slice(2) }, SECRET)).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: sig }, "")).toBe(false);
  });
});

describe("webhook signature", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: {} });
  const sig = createHmac("sha256", WH).update(body).digest("hex");
  it("verifies against the exact raw body", () => {
    expect(verifyWebhookSignature(body, sig, WH)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, WH)).toBe(false);
    expect(verifyWebhookSignature(JSON.stringify(JSON.parse(body), null, 2), sig, WH)).toBe(false);
    expect(verifyWebhookSignature(body, null, WH)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "")).toBe(false);
  });
});

function fakeDeps() {
  const claimed = new Set<string>();
  const deps: WebhookDeps & { calls: string[] } = {
    calls: [],
    claimEvent: vi.fn(async (id: string) => {
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    }),
    completeEvent: vi.fn(async () => {}),
    confirmPayment: vi.fn(async () => "confirmed"),
    markAuthorized: vi.fn(async () => {}),
    recordFailure: vi.fn(async () => {}),
    syncRefund: vi.fn(async () => "processed"),
  };
  return deps;
}

const captured = {
  event: "payment.captured",
  payload: {
    payment: {
      entity: { id: "pay_1", amount: 87600, currency: "INR", status: "captured", order_id: "order_1", method: "upi" },
    },
  },
};

describe("processRazorpayWebhook", () => {
  it("confirms captured payments with the gateway amount", async () => {
    const deps = fakeDeps();
    const r = await processRazorpayWebhook("evt_1", captured, deps);
    expect(r).toEqual({ status: "processed", detail: "confirmed" });
    expect(deps.confirmPayment).toHaveBeenCalledWith("order_1", "pay_1", 87600, "upi");
    expect(deps.completeEvent).toHaveBeenCalledWith("evt_1", "processed");
  });

  it("ignores duplicate deliveries of the same event", async () => {
    const deps = fakeDeps();
    await processRazorpayWebhook("evt_1", captured, deps);
    const r = await processRazorpayWebhook("evt_1", captured, deps);
    expect(r.status).toBe("duplicate");
    expect(deps.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it("does not confirm non-captured or non-INR payments", async () => {
    const deps = fakeDeps();
    const notCaptured = structuredClone(captured);
    notCaptured.payload.payment.entity.status = "authorized";
    expect((await processRazorpayWebhook("evt_2", notCaptured, deps)).status).toBe("ignored");
    const usd = structuredClone(captured);
    usd.payload.payment.entity.currency = "USD";
    await expect(processRazorpayWebhook("evt_3", usd, deps)).rejects.toThrow("Unexpected currency");
    expect(deps.completeEvent).toHaveBeenLastCalledWith("evt_3", "failed", "Unexpected currency");
    expect(deps.confirmPayment).not.toHaveBeenCalled();
  });

  it("records failures and refunds", async () => {
    const deps = fakeDeps();
    await processRazorpayWebhook(
      "evt_4",
      {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_2", amount: 100, currency: "INR", status: "failed", order_id: "order_2",
              error_code: "BAD_REQUEST_ERROR", error_description: "Payment failed",
            },
          },
        },
      },
      deps,
    );
    expect(deps.recordFailure).toHaveBeenCalledWith("order_2", "pay_2", "BAD_REQUEST_ERROR", "Payment failed");

    const reqId = "33333333-3333-4333-8333-333333333333";
    await processRazorpayWebhook(
      "evt_5",
      {
        event: "refund.processed",
        payload: { refund: { entity: { id: "rfnd_1", amount: 5000, payment_id: "pay_1", notes: { refund_request_id: reqId } } } },
      },
      deps,
    );
    expect(deps.syncRefund).toHaveBeenCalledWith({
      refundRequestId: reqId,
      paymentId: "pay_1",
      refundId: "rfnd_1",
      amountPaise: 5000,
      status: "processed",
    });
  });

  it("ignores unknown events and malformed payloads", async () => {
    const deps = fakeDeps();
    expect((await processRazorpayWebhook("evt_6", { event: "invoice.paid", payload: {} }, deps)).status).toBe("ignored");
    expect((await processRazorpayWebhook("evt_7", { nope: true }, deps)).status).toBe("ignored");
  });
});
