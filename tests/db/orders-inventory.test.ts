import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import {
  as,
  asService,
  closePool,
  createUser,
  createVariant,
  describeDb,
  getPool,
  grantRole,
  inventory,
  pgError,
  placeOrder,
} from "./helpers";

afterAll(closePool);

async function registerPayment(orderId: string, amount: number) {
  const providerOrderId = `order_${randomUUID().slice(0, 12)}`;
  await asService((c) => c.query("select public.register_payment_attempt($1, $2, $3)", [orderId, providerOrderId, amount]));
  return providerOrderId;
}

async function confirm(providerOrderId: string, paymentId: string, amount: number) {
  return asService(async (c) => {
    const { rows } = await c.query("select public.confirm_online_payment($1, $2, $3, 'upi') as r", [
      providerOrderId,
      paymentId,
      amount,
    ]);
    return rows[0].r as string;
  });
}

async function expireOrder(orderId: string) {
  await getPool().query("update public.orders set reservation_expires_at = now() - interval '1 minute' where id = $1", [
    orderId,
  ]);
  await asService((c) => c.query("select public.expire_pending_orders()"));
}

describeDb("place_order concurrency and idempotency", () => {
  it("lets exactly one of many concurrent buyers claim the last unit", async () => {
    const variant = await createVariant(1);
    const users = await Promise.all(Array.from({ length: 8 }, () => createUser()));
    const results = await Promise.allSettled(users.map((u) => placeOrder({ userId: u, variantId: variant })));
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(7);
    for (const f of failed) expect(pgError(f.reason)).toBe("OUT_OF_STOCK");
    expect(await inventory(variant)).toEqual({ on_hand: 1, reserved: 1 });
  });

  it("never oversells COD orders under concurrency", async () => {
    const variant = await createVariant(3);
    const users = await Promise.all(Array.from({ length: 10 }, () => createUser()));
    const results = await Promise.allSettled(
      users.map((u) => placeOrder({ userId: u, variantId: variant, method: "cod" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await inventory(variant)).toEqual({ on_hand: 0, reserved: 0 });
  });

  it("returns the same order for a repeated idempotency key (sequential and concurrent)", async () => {
    const variant = await createVariant(10);
    const user = await createUser();
    const key = randomUUID();
    const results = await Promise.all([
      placeOrder({ userId: user, variantId: variant, key, quantity: 2 }),
      placeOrder({ userId: user, variantId: variant, key, quantity: 2 }),
      placeOrder({ userId: user, variantId: variant, key, quantity: 2 }),
    ]);
    expect(new Set(results.map((r) => r.order_id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const again = await placeOrder({ userId: user, variantId: variant, key, quantity: 2 });
    expect(again.created).toBe(false);
    expect(await inventory(variant)).toEqual({ on_hand: 10, reserved: 2 });
  });

  it("rejects stale prices, bad totals and invalid quantities", async () => {
    const variant = await createVariant(10, 25000);
    const user = await createUser();
    await expect(placeOrder({ userId: user, variantId: variant, unitPrice: 100 })).rejects.toThrow("PRICE_CHANGED");
    await expect(placeOrder({ userId: user, variantId: variant, unitPrice: 25000, quantity: 11 })).rejects.toThrow(
      "INVALID_QUANTITY",
    );
    await expect(
      placeOrder({ userId: user, variantId: variant, unitPrice: 25000, discount: 500 }),
    ).rejects.toThrow("TOTAL_MISMATCH");
    expect(await inventory(variant)).toEqual({ on_hand: 10, reserved: 0 });
  });

  it("rejects inactive products", async () => {
    const variant = await createVariant(10);
    await getPool().query(
      "update public.products set status = 'archived' where id = (select product_id from public.product_variants where id = $1)",
      [variant],
    );
    await expect(placeOrder({ userId: await createUser(), variantId: variant })).rejects.toThrow(
      "VARIANT_UNAVAILABLE",
    );
  });
});

describeDb("payment confirmation, expiry and cancellation", () => {
  it("commits stock exactly once for duplicate confirmations", async () => {
    const variant = await createVariant(5);
    const order = await placeOrder({ userId: await createUser(), variantId: variant, quantity: 2 });
    const po = await registerPayment(order.order_id, 20000);
    const [a, b] = await Promise.all([confirm(po, "pay_1", 20000), confirm(po, "pay_1", 20000)]);
    expect([a, b].sort()).toEqual(["already_confirmed", "confirmed"]);
    expect(await confirm(po, "pay_1", 20000)).toBe("already_confirmed");
    expect(await inventory(variant)).toEqual({ on_hand: 3, reserved: 0 });
    const { rows } = await getPool().query("select status, payment_status from public.orders where id = $1", [
      order.order_id,
    ]);
    expect(rows[0]).toEqual({ status: "confirmed", payment_status: "paid" });
  });

  it("rejects an amount that does not match the order", async () => {
    const variant = await createVariant(5);
    const order = await placeOrder({ userId: await createUser(), variantId: variant });
    const po = await registerPayment(order.order_id, 10000);
    await expect(confirm(po, "pay_x", 9999)).rejects.toThrow("AMOUNT_MISMATCH");
    await expect(
      asService((c) => c.query("select public.register_payment_attempt($1, 'order_bad', 1)", [order.order_id])),
    ).rejects.toThrow("AMOUNT_MISMATCH");
  });

  it("flags a second distinct captured payment instead of double-counting", async () => {
    const variant = await createVariant(5);
    const order = await placeOrder({ userId: await createUser(), variantId: variant });
    const po = await registerPayment(order.order_id, 10000);
    expect(await confirm(po, "pay_a", 10000)).toBe("confirmed");
    expect(await confirm(po, "pay_b", 10000)).toBe("duplicate_payment");
    expect(await inventory(variant)).toEqual({ on_hand: 4, reserved: 0 });
  });

  it("releases reservations on expiry exactly once and allows late confirmation when stock remains", async () => {
    const variant = await createVariant(5);
    const order = await placeOrder({ userId: await createUser(), variantId: variant, quantity: 2 });
    const po = await registerPayment(order.order_id, 20000);
    await expireOrder(order.order_id);
    await expireOrder(order.order_id);
    expect(await inventory(variant)).toEqual({ on_hand: 5, reserved: 0 });
    expect(await confirm(po, "pay_late", 20000)).toBe("late_confirmed");
    expect(await inventory(variant)).toEqual({ on_hand: 3, reserved: 0 });
  });

  it("puts a late payment on hold when the stock has been sold meanwhile", async () => {
    const variant = await createVariant(1);
    const order = await placeOrder({ userId: await createUser(), variantId: variant });
    const po = await registerPayment(order.order_id, 10000);
    await expireOrder(order.order_id);
    await placeOrder({ userId: await createUser(), variantId: variant, method: "cod" });
    expect(await confirm(po, "pay_late2", 10000)).toBe("on_hold");
    expect(await inventory(variant)).toEqual({ on_hand: 0, reserved: 0 });
  });

  it("does not expire an order with an authorized payment in flight", async () => {
    const variant = await createVariant(2);
    const order = await placeOrder({ userId: await createUser(), variantId: variant });
    const po = await registerPayment(order.order_id, 10000);
    await getPool().query("update public.payments set status = 'authorized' where provider_order_id = $1", [po]);
    await expireOrder(order.order_id);
    expect(await inventory(variant)).toEqual({ on_hand: 2, reserved: 1 });
  });

  it("restores stock once when a COD order is cancelled", async () => {
    const variant = await createVariant(4);
    const user = await createUser();
    const order = await placeOrder({ userId: user, variantId: variant, method: "cod", quantity: 3 });
    expect(await inventory(variant)).toEqual({ on_hand: 1, reserved: 0 });
    const r = await as("authenticated", user, (c) =>
      c.query("select public.cancel_order($1, 'Changed my mind') as r", [order.order_id]),
    );
    expect(r.rows[0].r).toBe("cancelled");
    expect(await inventory(variant)).toEqual({ on_hand: 4, reserved: 0 });
    await expect(
      as("authenticated", user, (c) => c.query("select public.cancel_order($1, 'again please')", [order.order_id])),
    ).rejects.toThrow("NOT_CANCELLABLE");
    expect(await inventory(variant)).toEqual({ on_hand: 4, reserved: 0 });
  });

  it("does not let customers cancel other people's or paid orders", async () => {
    const variant = await createVariant(4);
    const owner = await createUser();
    const other = await createUser();
    const order = await placeOrder({ userId: owner, variantId: variant });
    await expect(
      as("authenticated", other, (c) => c.query("select public.cancel_order($1, 'not mine')", [order.order_id])),
    ).rejects.toThrow("FORBIDDEN");
    const po = await registerPayment(order.order_id, 10000);
    await confirm(po, "pay_c", 10000);
    await expect(
      as("authenticated", owner, (c) => c.query("select public.cancel_order($1, 'please cancel')", [order.order_id])),
    ).rejects.toThrow("NOT_CANCELLABLE");
  });

  it("lets staff cancel a paid order and flags it for refund", async () => {
    const variant = await createVariant(4);
    const staff = await createUser();
    await grantRole(staff, "operations");
    const order = await placeOrder({ userId: await createUser(), variantId: variant, quantity: 2 });
    const po = await registerPayment(order.order_id, 20000);
    await confirm(po, "pay_s", 20000);
    const r = await as("authenticated", staff, (c) =>
      c.query("select public.cancel_order($1, 'Out of delivery area') as r", [order.order_id]),
    );
    expect(r.rows[0].r).toBe("cancelled_refund_required");
    expect(await inventory(variant)).toEqual({ on_hand: 4, reserved: 0 });
  });

  it("enforces fulfilment transitions for staff only", async () => {
    const variant = await createVariant(4);
    const staff = await createUser();
    await grantRole(staff, "operations");
    const customer = await createUser();
    const order = await placeOrder({ userId: customer, variantId: variant, method: "cod" });
    await expect(
      as("authenticated", customer, (c) =>
        c.query("select public.update_order_status($1, 'shipped', null)", [order.order_id]),
      ),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      as("authenticated", staff, (c) => c.query("select public.update_order_status($1, 'delivered', null)", [order.order_id])),
    ).rejects.toThrow("INVALID_TRANSITION");
    for (const s of ["packed", "shipped", "delivered"]) {
      await as("authenticated", staff, (c) => c.query("select public.update_order_status($1, $2, null)", [order.order_id, s]));
    }
    // Operations staff cannot mark COD collected; admins can.
    await expect(
      as("authenticated", staff, (c) => c.query("select public.mark_cod_collected($1, 'cash')", [order.order_id])),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describeDb("coupons", () => {
  it("enforces a global usage limit under concurrency and reverses on cancellation", async () => {
    const { rows } = await getPool().query(
      "insert into public.coupons (code, discount_type, discount_value, usage_limit) values ($1, 'fixed', 1000, 1) returning id",
      [`T${randomUUID().slice(0, 8)}`],
    );
    const coupon = rows[0].id;
    const variant = await createVariant(10);
    const users = await Promise.all(Array.from({ length: 4 }, () => createUser()));
    const results = await Promise.allSettled(
      users.map((u) => placeOrder({ userId: u, variantId: variant, method: "cod", couponId: coupon, discount: 1000 })),
    );
    const ok = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ order_id: string }>[];
    expect(ok).toHaveLength(1);
    const used = await getPool().query("select used_count from public.coupons where id = $1", [coupon]);
    expect(used.rows[0].used_count).toBe(1);
    await asService((c) => c.query("select public.cancel_order($1, 'test cancel')", [ok[0].value.order_id]));
    const after = await getPool().query("select used_count from public.coupons where id = $1", [coupon]);
    expect(after.rows[0].used_count).toBe(0);
  });

  it("enforces the per-customer limit", async () => {
    const { rows } = await getPool().query(
      "insert into public.coupons (code, discount_type, discount_value, per_customer_limit) values ($1, 'fixed', 500, 1) returning id",
      [`P${randomUUID().slice(0, 8)}`],
    );
    const variant = await createVariant(10);
    const user = await createUser();
    await placeOrder({ userId: user, variantId: variant, method: "cod", couponId: rows[0].id, discount: 500 });
    await expect(
      placeOrder({ userId: user, variantId: variant, method: "cod", couponId: rows[0].id, discount: 500 }),
    ).rejects.toThrow("COUPON_LIMIT_REACHED");
  });
});

describeDb("refunds", () => {
  it("applies a processed refund exactly once and blocks over-refunds", async () => {
    const variant = await createVariant(5);
    const admin = await createUser();
    await grantRole(admin, "admin");
    const order = await placeOrder({ userId: await createUser(), variantId: variant, quantity: 2 });
    const po = await registerPayment(order.order_id, 20000);
    await confirm(po, "pay_r1", 20000);

    const req = await asService(async (c) => {
      const { rows } = await c.query("select * from public.create_refund_request($1, 15000, 'Damaged pack', $2, $3)", [
        order.order_id,
        admin,
        `refund-${order.order_id}-1`,
      ]);
      return rows[0];
    });
    expect(req.provider_payment_id).toBe("pay_r1");
    await expect(
      asService((c) =>
        c.query("select * from public.create_refund_request($1, 6000, 'too much', $2, $3)", [
          order.order_id,
          admin,
          `refund-${order.order_id}-2`,
        ]),
      ),
    ).rejects.toThrow("REFUND_EXCEEDS_BALANCE");

    const sync = () =>
      asService(async (c) => {
        const { rows } = await c.query(
          "select public.sync_refund($1, 'pay_r1', 'rfnd_1', 15000, 'processed', null) as r",
          [req.refund_id],
        );
        return rows[0].r as string;
      });
    expect(await sync()).toBe("processed");
    expect(await sync()).toBe("already_processed");
    const { rows } = await getPool().query(
      "select status, payment_status, refunded_paise from public.orders where id = $1",
      [order.order_id],
    );
    expect(rows[0]).toEqual({ status: "partially_refunded", payment_status: "partially_refunded", refunded_paise: "15000" });
  });
});

describeDb("inventory adjustments", () => {
  it("requires staff, a reason, and never goes below reserved stock", async () => {
    const variant = await createVariant(2);
    const staff = await createUser();
    await grantRole(staff, "operations");
    const customer = await createUser();
    await placeOrder({ userId: customer, variantId: variant, quantity: 2 });

    await expect(
      as("authenticated", customer, (c) => c.query("select public.adjust_inventory($1, 10, 'free stock')", [variant])),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      as("authenticated", staff, (c) => c.query("select public.adjust_inventory($1, 5, '')", [variant])),
    ).rejects.toThrow("REASON_REQUIRED");
    await expect(
      as("authenticated", staff, (c) => c.query("select public.adjust_inventory($1, -1, 'damaged')", [variant])),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    await as("authenticated", staff, (c) => c.query("select public.adjust_inventory($1, 8, 'New batch received')", [variant]));
    expect(await inventory(variant)).toEqual({ on_hand: 10, reserved: 2 });
    const { rows } = await getPool().query(
      "select count(*)::int as n from public.inventory_movements where variant_id = $1 and reason = 'adjustment'",
      [variant],
    );
    expect(rows[0].n).toBe(1);
  });
});
