import { afterAll, expect, it } from "vitest";
import { as, closePool, createUser, createVariant, describeDb, getPool, grantRole, placeOrder } from "./helpers";

afterAll(closePool);

describeDb("row level security", () => {
  it("customers see only their own orders", async () => {
    const a = await createUser();
    const b = await createUser();
    const variant = await createVariant(5);
    const order = await placeOrder({ userId: a, variantId: variant });
    const own = await as("authenticated", a, (c) => c.query("select id from public.orders where id = $1", [order.order_id]));
    const other = await as("authenticated", b, (c) => c.query("select id from public.orders where id = $1", [order.order_id]));
    const anon = await as("anon", null, (c) => c.query("select id from public.orders"));
    expect(own.rowCount).toBe(1);
    expect(other.rowCount).toBe(0);
    expect(anon.rowCount).toBe(0);
    const items = await as("authenticated", b, (c) =>
      c.query("select id from public.order_items where order_id = $1", [order.order_id]),
    );
    expect(items.rowCount).toBe(0);
  });

  it("customers cannot write orders, payments, inventory or roles directly", async () => {
    const a = await createUser();
    const variant = await createVariant(5);
    const order = await placeOrder({ userId: a, variantId: variant });
    await expect(
      as("authenticated", a, (c) => c.query("update public.orders set total_paise = 1 where id = $1", [order.order_id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as("authenticated", a, (c) => c.query("update public.inventory set on_hand = 999 where variant_id = $1", [variant])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as("authenticated", a, (c) => c.query("insert into public.user_roles (user_id, role) values ($1, 'owner')", [a])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as("authenticated", a, (c) =>
        c.query("insert into public.payments (order_id, provider_order_id, amount_paise) values ($1, 'x', 1)", [
          order.order_id,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as("authenticated", a, (c) =>
        c.query("select * from public.place_order($1, 'abcdefgh1', 'cod', '[]', 0,0,0,0,0,null,'{}',null,'9876543210',null,30)", [a]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("customers cannot change catalogue prices; admins can", async () => {
    const customer = await createUser();
    const admin = await createUser();
    await grantRole(admin, "admin");
    const variant = await createVariant(5, 10000);
    const res = await as("authenticated", customer, (c) =>
      c.query("update public.product_variants set price_paise = 1 where id = $1", [variant]),
    );
    expect(res.rowCount).toBe(0);
    const ok = await as("authenticated", admin, (c) =>
      c.query("update public.product_variants set price_paise = 12000 where id = $1", [variant]),
    );
    expect(ok.rowCount).toBe(1);
  });

  it("operations staff can read orders but cannot edit the catalogue", async () => {
    const ops = await createUser();
    await grantRole(ops, "operations");
    const variant = await createVariant(5);
    const res = await as("authenticated", ops, (c) =>
      c.query("update public.product_variants set price_paise = 1 where id = $1", [variant]),
    );
    expect(res.rowCount).toBe(0);
    const orders = await as("authenticated", ops, (c) => c.query("select count(*) from public.orders"));
    expect(Number(orders.rows[0].count)).toBeGreaterThan(0);
  });

  it("coupons are not readable by customers or anonymous visitors", async () => {
    const a = await createUser();
    const anon = await as("anon", null, (c) => c.query("select * from public.coupons"));
    const cust = await as("authenticated", a, (c) => c.query("select * from public.coupons"));
    expect(anon.rowCount).toBe(0);
    expect(cust.rowCount).toBe(0);
  });

  it("profiles: only name/phone are editable and only by the owner", async () => {
    const a = await createUser();
    const b = await createUser();
    const upd = await as("authenticated", a, (c) =>
      c.query("update public.profiles set full_name = 'Asha' where id = $1", [a]),
    );
    expect(upd.rowCount).toBe(1);
    const other = await as("authenticated", b, (c) =>
      c.query("update public.profiles set full_name = 'Hacker' where id = $1", [a]),
    );
    expect(other.rowCount).toBe(0);
    await expect(
      as("authenticated", a, (c) => c.query("update public.profiles set created_at = now() where id = $1", [a])),
    ).rejects.toThrow(/permission denied/);
  });

  it("reviews are forced to pending with a server-derived verified flag", async () => {
    const a = await createUser();
    const { rows } = await getPool().query("select id from public.products where status = 'active' limit 1");
    const review = await as("authenticated", a, (c) =>
      c.query(
        "insert into public.product_reviews (product_id, user_id, author_name, rating, body) values ($1, $2, 'A', 5, 'Lovely and fresh product') returning status, is_verified_purchase",
        [rows[0].id, a],
      ),
    );
    expect(review.rows[0]).toEqual({ status: "pending", is_verified_purchase: false });
    await expect(
      as("authenticated", a, (c) =>
        c.query(
          "insert into public.product_reviews (product_id, user_id, author_name, rating, body, status) values ($1, $2, 'A', 5, 'Self approved review', 'approved')",
          [rows[0].id, a],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    const upd = await as("authenticated", a, (c) =>
      c.query("update public.product_reviews set status = 'approved' where user_id = $1", [a]),
    );
    expect(upd.rowCount).toBe(0);
    const pub = await as("anon", null, (c) =>
      c.query("select id from public.product_reviews where user_id = $1", [a]),
    );
    expect(pub.rowCount).toBe(0);
  });

  it("anonymous visitors cannot read inventory movements or webhook events", async () => {
    const m = await as("anon", null, (c) => c.query("select * from public.inventory_movements limit 1"));
    expect(m.rowCount).toBe(0);
    const w = await as("anon", null, (c) => c.query("select * from public.payment_webhook_events limit 1"));
    expect(w.rowCount).toBe(0);
  });

  it("storage writes require an admin", async () => {
    const a = await createUser();
    const admin = await createUser();
    await grantRole(admin, "admin");
    await expect(
      as("authenticated", a, (c) =>
        c.query("insert into storage.objects (bucket_id, name) values ('product-images', 'x.png')"),
      ),
    ).rejects.toThrow(/row-level security/);
    const ok = await as("authenticated", admin, (c) =>
      c.query("insert into storage.objects (bucket_id, name) values ('product-images', 'products/x.png')"),
    );
    expect(ok.rowCount).toBe(1);
  });
});
