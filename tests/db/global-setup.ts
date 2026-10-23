import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

/**
 * Recreates the test database from the Supabase shim + migrations + seed.
 * Runs only when TEST_DATABASE_URL is set (a throwaway local PostgreSQL —
 * never point this at a real Supabase project: it DROPS the database).
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;

  const target = new URL(url);
  const dbName = target.pathname.replace(/^\//, "");
  if (!/^[a-z0-9_]*test[a-z0-9_]*$/.test(dbName)) {
    throw new Error(`Refusing to reset database "${dbName}": name must contain "test".`);
  }
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const adminClient = new Client({ connectionString: admin.toString() });
  await adminClient.connect();
  await adminClient.query(`drop database if exists ${dbName} with (force)`);
  await adminClient.query(`create database ${dbName}`);
  await adminClient.end();

  const root = path.resolve(__dirname, "../..");
  const files = [
    path.join(root, "supabase/tests/supabase_shim.sql"),
    ...readdirSync(path.join(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => path.join(root, "supabase/migrations", f)),
    path.join(root, "supabase/seed.sql"),
  ];
  const client = new Client({ connectionString: url });
  await client.connect();
  for (const file of files) {
    await client.query(readFileSync(file, "utf8"));
  }
  await client.end();
}
