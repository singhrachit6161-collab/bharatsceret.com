import { afterAll, expect, it } from "vitest";
import { as, asService, closePool, createUser, createVariant, describeDb, getPool, grantRole, placeOrder } from "./helpers";

afterAll(closePool);

const doc = (total: number) => ({
  document_type: "bill_of_supply",
  seller: { name: "Bharat Secrets" },
  buyer: { name: "Test" },
  place_of_supply: "Maharashtra (27)",
  intra_state: true,
  lines: [{ description: "Item", quantity: 1, total_paise: total }],
  taxable_paise: total,
  cgst_paise: 0,
  sgst_paise: 0,
  igst_paise: 0,
  total_paise: total,
});

async function codOrder(status?: string, deliveredDaysAgo?: number) {
  const user = await createUser();
  const variant = await createVariant(10, 25000);
  const o = await placeOrder({ userId: user, variantId: variant, quantity: 2, unitPrice: 25000, method: "cod" });
  if (status) {
    await getPool().query(
      `update public.orders set status = $2, delivered_at = case when $3::int is null then null else now() - make_interval(days => $3::int) end where id = $1`,
      [o.order_id, status, deliveredDaysAgo ?? null],
    );
  }
  return { user, variant, orderId: o.order_id };
}

const issue = (orderId: string, total = 50000) =>
  asService((c) => c.query("select * from public.issue_invoice($1, $2::jsonb, null)", [orderId, JSON.stringify(doc(total))]));

describeDb("GST invoices", () => {
  it("issues sequential, idempotent, immutable invoices only once an order is packed", async () => {
    const a = await codOrder();
    await expect(issue(a.orderId)).rejects.toThrow(/INVOICE_NOT_READY/);
    await getPool().query("update public.orders set status = 'packed' where id = $1", [a.orderId]);
    await expect(issue(a.orderId, 1)).rejects.toThrow(/INVOICE_TOTAL_MISMATCH/);
    const first = (await issue(a.orderId)).rows[0];
    expect(first.created).toBe(true);
    expect(first.invoice_number).toMatch(/^BS\/\d{4}\/\d{5}$/);
    const again = (await issue(a.orderId)).rows[0];
    expect(again).toMatchObject({ invoice_id: first.invoice_id, created: false });

    const b = await codOrder("shipped");
    const second = (await issue(b.orderId)).rows[0];
    const n = (s: string) => Number(s.split("/")[2]);
    expect(n(second.invoice_number)).toBe(n(first.invoice_number) + 1);

    await expect(getPool().query("update public.invoices set total_paise = 1 where id = $1", [first.invoice_id])).rejects.toThrow(/INVOICE_IMMUTABLE/);
  });

  it("lets customers read only their own invoices and never issue them", async () => {
    const a = await codOrder("packed");
    await issue(a.orderId);
    const own = await as("authenticated", a.user, (c) => c.query("select invoice_number from public.invoices where order_id = $1", [a.orderId]));
    expect(own.rows).toHaveLength(1);
    const other = await as("authenticated", await createUser(), (c) => c.query("select id from public.invoices where order_id = $1", [a.orderId]));
    expect(other.rows).toHaveLength(0);
    await expect(as("authenticated", a.user, (c) => c.query("select * from public.issue_invoice($1, $2::jsonb, null)", [a.orderId, JSON.stringify(doc(50000))]))).rejects.toThrow(/permission denied/);
  });
});

describeDb("return requests", () => {
  const request = (user: string, orderId: string, items: unknown, reason = "damaged") =>
    as("authenticated", user, (c) => c.query("select public.request_return($1, $2, $3, $4::jsonb) as id", [orderId, reason, "The box arrived crushed and leaking.", JSON.stringify(items)]));
  const itemOf = async (orderId: string) => (await getPool().query("select id, quantity from public.order_items where order_id = $1", [orderId])).rows[0];

  it("accepts one open request per delivered order within the window", async () => {
    const shipped = await codOrder("shipped");
    const si = await itemOf(shipped.orderId);
    await expect(request(shipped.user, shipped.orderId, [{ order_item_id: si.id, quantity: 1 }])).rejects.toThrow(/RETURN_NOT_ALLOWED/);

    const o = await codOrder("delivered", 1);
    const item = await itemOf(o.orderId);
    await expect(request(o.user, o.orderId, [{ order_item_id: item.id, quantity: 3 }])).rejects.toThrow(/INVALID_RETURN_ITEMS/);
    await expect(request(o.user, o.orderId, [{ order_item_id: item.id, quantity: 1 }], "bogus")).rejects.toThrow(/INVALID_RETURN/);
    await expect(request(await createUser(), o.orderId, [{ order_item_id: item.id, quantity: 1 }])).rejects.toThrow(/ORDER_NOT_FOUND/);
    const ok = await request(o.user, o.orderId, [{ order_item_id: item.id, quantity: 2 }]);
    expect(ok.rows[0].id).toBeTruthy();
    await expect(request(o.user, o.orderId, [{ order_item_id: item.id, quantity: 1 }])).rejects.toThrow(/RETURN_ALREADY_OPEN/);

    const late = await codOrder("delivered", 30);
    const li = await itemOf(late.orderId);
    await expect(request(late.user, late.orderId, [{ order_item_id: li.id, quantity: 1 }])).rejects.toThrow(/RETURN_WINDOW_CLOSED/);
  });

  it("only staff move a request through its states", async () => {
    const o = await codOrder("delivered", 0);
    const item = await itemOf(o.orderId);
    const id = (await request(o.user, o.orderId, [{ order_item_id: item.id, quantity: 1 }])).rows[0].id;
    const update = (actor: string, status: string, note: string | null) =>
      as("authenticated", actor, (c) => c.query("select public.update_return_request($1, $2, $3)", [id, status, note]));
    await expect(update(o.user, "approved", null)).rejects.toThrow(/FORBIDDEN/);
    const staff = await createUser();
    await grantRole(staff, "operations");
    await expect(update(staff, "refunded", null)).rejects.toThrow(/INVALID_TRANSITION/);
    await expect(update(staff, "rejected", null)).rejects.toThrow(/REASON_REQUIRED/);
    await update(staff, "approved", "We will arrange a pickup.");
    await update(staff, "refunded", null);
    const { rows } = await as("authenticated", o.user, (c) => c.query("select status, resolution_note from public.return_requests where id = $1", [id]));
    expect(rows[0]).toEqual({ status: "refunded", resolution_note: "We will arrange a pickup." });
    // Customers cannot write the table directly.
    await expect(as("authenticated", o.user, (c) => c.query("update public.return_requests set status = 'refunded' where id = $1", [id]))).rejects.toThrow(/permission denied/);
  });
});

describeDb("back-in-stock alerts", () => {
  it("subscribes with the account email and becomes ready when stock returns", async () => {
    const user = await createUser("alerts@example.test");
    const variant = await createVariant(0);
    const sub = () => as("authenticated", user, (c) => c.query("select public.subscribe_stock_alert($1) as r", [variant]));
    expect((await sub()).rows[0].r).toBe("subscribed");
    expect((await sub()).rows[0].r).toBe("already_subscribed");
    const ready = () => asService((c) => c.query("select * from public.ready_stock_alerts(500)"));
    expect((await ready()).rows.some((r) => r.email === "alerts@example.test")).toBe(false);
    await getPool().query("update public.inventory set on_hand = 3 where variant_id = $1", [variant]);
    const row = (await ready()).rows.find((r) => r.email === "alerts@example.test");
    expect(row).toBeTruthy();
    await expect(as("authenticated", user, (c) => c.query("select * from public.ready_stock_alerts(10)"))).rejects.toThrow(/permission denied/);
    await expect(as("anon", null, (c) => c.query("select public.subscribe_stock_alert($1)", [variant]))).rejects.toThrow(/permission denied/);
  });
});

describeDb("carrier tracking events", () => {
  it("applies each event once and only moves the order forward", async () => {
    const o = await codOrder("packed");
    const awb = `AWB${Date.now()}`;
    await getPool().query("insert into public.shipments (order_id, carrier, provider, tracking_number, status) values ($1, 'Delhivery', 'shiprocket', $2, 'packed')", [o.orderId, awb]);
    const event = (status: string, id: string) =>
      asService((c) => c.query("select public.apply_carrier_event('shiprocket', $1, $2, $3, 'Pune', $4, now()) as r", [awb, status, status.toUpperCase(), id]));
    expect((await event("in_transit", "e1")).rows[0].r).toMatchObject({ result: "applied", order_status: "shipped" });
    expect((await event("in_transit", "e1")).rows[0].r).toMatchObject({ result: "duplicate" });
    expect((await event("delivered", "e2")).rows[0].r).toMatchObject({ result: "applied", order_status: "delivered" });
    expect((await event("in_transit", "e3")).rows[0].r).toMatchObject({ result: "logged" });
    const { rows } = await getPool().query(
      "select o.status, o.delivered_at is not null as delivered, s.status as ship from public.orders o join public.shipments s on s.order_id = o.id where o.id = $1",
      [o.orderId],
    );
    expect(rows[0]).toEqual({ status: "delivered", delivered: true, ship: "delivered" });
    expect((await asService((c) => c.query("select public.apply_carrier_event('shiprocket', 'NOPE', 'shipped', null, null, 'x', now()) as r"))).rows[0].r).toEqual({ result: "unknown_shipment" });
    await expect(as("authenticated", o.user, (c) => c.query("select public.apply_carrier_event('shiprocket', $1, 'delivered', null, null, 'y', now())", [awb]))).rejects.toThrow(/permission denied/);
  });
});
