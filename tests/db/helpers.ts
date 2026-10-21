import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { describe } from "vitest";

export const dbUrl = process.env.TEST_DATABASE_URL;
export const describeDb = dbUrl ? describe : describe.skip;

let pool: Pool | null = null;
export function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: dbUrl, max: 20 });
  return pool;
}

export async function closePool() {
  await pool?.end();
  pool = null;
}

type Role = "anon" | "authenticated" | "service_role";

/** Run fn inside a transaction impersonating a Supabase role + JWT subject. */
export async function as<T>(
  role: Role,
  userId: string | null,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
    await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await client.query(`set local role ${role}`);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export const asService = <T>(fn: (c: PoolClient) => Promise<T>) => as("service_role", null, fn);

export async function createUser(email?: string): Promise<string> {
  const id = randomUUID();
  await getPool().query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email ?? `${id}@example.test`,
    { full_name: "Test User" },
  ]);
  return id;
}

export async function grantRole(userId: string, role: "owner" | "admin" | "operations") {
  await getPool().query("insert into public.user_roles (user_id, role) values ($1, $2)", [userId, role]);
}

/** Create an isolated product+variant with the given stock and price. */
export async function createVariant(stock: number, pricePaise = 10000): Promise<string> {
  const p = getPool();
  const slug = `test-${randomUUID().slice(0, 8)}`;
  const { rows } = await p.query(
    "insert into public.products (name, slug, status, published_at) values ($1, $2, 'active', now() - interval '1 day') returning id",
    [`Test ${slug}`, slug],
  );
  const v = await p.query(
    "insert into public.product_variants (product_id, sku, label, price_paise) values ($1, $2, '100 g', $3) returning id",
    [rows[0].id, slug.toUpperCase(), pricePaise],
  );
  await p.query("update public.inventory set on_hand = $2 where variant_id = $1", [v.rows[0].id, stock]);
  return v.rows[0].id;
}

export async function inventory(variantId: string) {
  const { rows } = await getPool().query("select on_hand, reserved from public.inventory where variant_id = $1", [
    variantId,
  ]);
  return rows[0] as { on_hand: number; reserved: number };
}

export interface PlaceArgs {
  userId: string;
  variantId: string;
  quantity?: number;
  unitPrice?: number;
  method?: "razorpay" | "cod";
  key?: string;
  couponId?: string | null;
  discount?: number;
}

export async function placeOrder(a: PlaceArgs) {
  const qty = a.quantity ?? 1;
  const price = a.unitPrice ?? 10000;
  const subtotal = qty * price;
  const discount = a.discount ?? 0;
  const total = subtotal - discount;
  return asService(async (c) => {
    const { rows } = await c.query(
      `select * from public.place_order($1, $2, $3, $4::jsonb, $5, $6, 0, 0, $7, $8, $9::jsonb, null, '9876543210', null, 30)`,
      [
        a.userId,
        a.key ?? randomUUID(),
        a.method ?? "razorpay",
        JSON.stringify([{ variant_id: a.variantId, quantity: qty, unit_price_paise: price }]),
        subtotal,
        discount,
        total,
        a.couponId ?? null,
        JSON.stringify({ full_name: "Test", phone: "9876543210", line1: "1 Street", city: "Pune", state: "MH", pincode: "411001" }),
      ],
    );
    return rows[0] as { order_id: string; order_number: string; created: boolean };
  });
}

export function pgError(e: unknown): string {
  return (e as { message?: string })?.message ?? String(e);
}
