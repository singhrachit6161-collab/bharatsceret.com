import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { as, asService, closePool, createUser, createVariant, describeDb, getPool, inventory } from "./helpers";

afterAll(closePool);

async function createBox(capacity: number, stock: number, price = 50000) {
  const v = await createVariant(stock, price);
  await getPool().query("update public.product_variants set hamper_capacity = $2 where id = $1", [v, capacity]);
  return v;
}

const ADDRESS = { full_name: "Test", phone: "9876543210", line1: "1 Street", city: "Pune", state: "MH", pincode: "411001" };

/** Place an order whose p_items are the aggregated quantities; prices come from the DB. */
async function placeWithBundles(
  userId: string,
  items: { variant: string; qty: number }[],
  bundles: unknown[],
  method: "razorpay" | "cod" = "cod",
) {
  const { rows: prices } = await getPool().query("select id, price_paise from public.product_variants where id = any($1)", [
    items.map((i) => i.variant),
  ]);
  const priceOf = new Map(prices.map((r) => [r.id as string, Number(r.price_paise)]));
  const payload = items.map((i) => ({ variant_id: i.variant, quantity: i.qty, unit_price_paise: priceOf.get(i.variant) }));
  const subtotal = payload.reduce((n, i) => n + i.unit_price_paise! * i.quantity, 0);
  return asService(async (c) => {
    const { rows } = await c.query(
      `select * from public.place_order($1, $2, $3, $4::jsonb, $5, 0, 0, 0, $5, null, $6::jsonb, null, '9876543210', null, 30, $7::jsonb)`,
      [userId, randomUUID(), method, JSON.stringify(payload), subtotal, JSON.stringify(ADDRESS), JSON.stringify(bundles)],
    );
    return rows[0] as { order_id: string };
  });
}

describeDb("build your own hamper", () => {
  it("places a hamper order, reserves box + contents and snapshots the hamper", async () => {
    const box = await createBox(4, 5);
    const a = await createVariant(10, 20000);
    const b = await createVariant(10, 30000);
    const user = await createUser();
    const order = await placeWithBundles(
      user,
      [{ variant: box, qty: 1 }, { variant: a, qty: 3 }, { variant: b, qty: 1 }],
      [{ box_variant_id: box, contents: [{ variant_id: a, quantity: 2 }, { variant_id: b, quantity: 1 }], recipient_name: "Nani", gift_message: "Happy Diwali" }],
      "razorpay",
    );
    // one extra unit of `a` is a standalone line
    expect(await inventory(box)).toEqual({ on_hand: 5, reserved: 1 });
    expect(await inventory(a)).toEqual({ on_hand: 10, reserved: 3 });
    const { rows } = await as("authenticated", user, (c) =>
      c.query("select box_label, capacity, recipient_name, gift_message, contents from public.order_bundles where order_id = $1", [order.order_id]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ capacity: 4, recipient_name: "Nani", gift_message: "Happy Diwali" });
    expect(rows[0].contents.map((c: { quantity: number }) => c.quantity).sort()).toEqual([1, 2]);
    // Another customer cannot see it.
    const other = await as("authenticated", await createUser(), (c) =>
      c.query("select id from public.order_bundles where order_id = $1", [order.order_id]),
    );
    expect(other.rowCount).toBe(0);
  });

  it("rejects hampers over capacity", async () => {
    const box = await createBox(2, 5);
    const a = await createVariant(10);
    await expect(
      placeWithBundles(await createUser(), [{ variant: box, qty: 1 }, { variant: a, qty: 3 }], [
        { box_variant_id: box, contents: [{ variant_id: a, quantity: 3 }] },
      ]),
    ).rejects.toThrow("BUNDLE_OVER_CAPACITY");
  });

  it("rejects boxes bought without a hamper and contents not covered by the order", async () => {
    const box = await createBox(4, 5);
    const a = await createVariant(10);
    await expect(placeWithBundles(await createUser(), [{ variant: box, qty: 1 }, { variant: a, qty: 1 }], [])).rejects.toThrow(
      "BOX_WITHOUT_HAMPER",
    );
    await expect(
      placeWithBundles(await createUser(), [{ variant: box, qty: 1 }, { variant: a, qty: 1 }], [
        { box_variant_id: box, contents: [{ variant_id: a, quantity: 2 }] },
      ]),
    ).rejects.toThrow("INVALID_BUNDLE");
  });

  it("rejects a non-box as the box, a box inside a box, and over-long messages", async () => {
    const box = await createBox(4, 5);
    const box2 = await createBox(4, 5);
    const a = await createVariant(10);
    const user = await createUser();
    await expect(
      placeWithBundles(user, [{ variant: a, qty: 2 }], [{ box_variant_id: a, contents: [{ variant_id: a, quantity: 1 }] }]),
    ).rejects.toThrow("INVALID_BUNDLE");
    await expect(
      placeWithBundles(user, [{ variant: box, qty: 1 }, { variant: box2, qty: 1 }], [
        { box_variant_id: box, contents: [{ variant_id: box2, quantity: 1 }] },
      ]),
    ).rejects.toThrow(/INVALID_BUNDLE|BOX_WITHOUT_HAMPER/);
    await expect(
      placeWithBundles(user, [{ variant: box, qty: 1 }, { variant: a, qty: 1 }], [
        { box_variant_id: box, contents: [{ variant_id: a, quantity: 1 }], gift_message: "x".repeat(301) },
      ]),
    ).rejects.toThrow("INVALID_BUNDLE");
  });

  it("never oversells the last box under concurrency", async () => {
    const box = await createBox(4, 1);
    const a = await createVariant(50);
    const users = await Promise.all(Array.from({ length: 5 }, () => createUser()));
    const results = await Promise.allSettled(
      users.map((u) =>
        placeWithBundles(u, [{ variant: box, qty: 1 }, { variant: a, qty: 2 }], [
          { box_variant_id: box, contents: [{ variant_id: a, quantity: 2 }] },
        ]),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await inventory(box)).toEqual({ on_hand: 0, reserved: 0 });
  });

  it("hides boxes from storefront listings", async () => {
    const box = await createBox(4, 5);
    const { rows } = await as("anon", null, (c) =>
      c.query("select variant_count from public.product_listing where id = (select product_id from public.product_variants where id = $1)", [box]),
    );
    expect(rows[0].variant_count).toBe(0);
  });
});
