import { afterAll, expect, it } from "vitest";
import { as, closePool, describeDb, getPool } from "./helpers";

afterAll(closePool);

describeDb("nested catalogue", () => {
  it("lists a product under its categories and every ancestor collection", async () => {
    const { rows } = await as("anon", null, (c) =>
      c.query("select category_slugs from public.product_listing where slug = 'walnut-kernels'"),
    );
    expect(rows[0].category_slugs).toEqual(expect.arrayContaining(["walnuts", "dry-fruits", "kashmir", "regions"]));
  });

  it("returns sub-collection products on a parent collection", async () => {
    const parent = await as("anon", null, (c) =>
      c.query("select slug from public.product_listing where category_slugs @> array['dry-fruits']"),
    );
    const slugs = parent.rows.map((r) => r.slug);
    expect(slugs).toEqual(expect.arrayContaining(["california-almonds", "whole-cashews-w320", "soft-dates"]));
    expect(slugs).not.toContain("kashmiri-kahwa");
  });

  it("prevents category cycles", async () => {
    await expect(
      getPool().query(
        "update public.categories set parent_id = (select id from public.categories where slug = 'almonds') where slug = 'dry-fruits'",
      ),
    ).rejects.toThrow("CATEGORY_CYCLE");
  });
});
