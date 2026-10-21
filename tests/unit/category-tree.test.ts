import { describe, expect, it } from "vitest";
import { ancestorsOf, buildTree, childrenOf, flattenTree, withAncestorIds } from "@/lib/category-tree";
import type { Category } from "@/lib/types";

const cat = (id: string, parent: string | null, sort = 0): Category => ({
  id, parent_id: parent, name: id, slug: id, description: null, image_url: null, sort_order: sort,
  is_visible: true, show_in_nav: true, seo_title: null, seo_description: null,
});

const all = [
  cat("dry-fruits", null, 10), cat("spices", null, 20), cat("regions", null, 30),
  cat("almonds", "dry-fruits", 2), cat("cashews", "dry-fruits", 1),
  cat("kashmir", "regions"), cat("saffron", "spices"), cat("orphan", "missing"),
];

describe("category tree", () => {
  it("builds a sorted tree; unknown parents become roots", () => {
    const tree = buildTree(all);
    expect(tree.map((n) => n.id)).toEqual(["orphan", "dry-fruits", "spices", "regions"]);
    expect(tree[1].children.map((n) => n.id)).toEqual(["cashews", "almonds"]);
  });

  it("finds ancestors and expands ids with them", () => {
    expect(ancestorsOf("almonds", all).map((c) => c.id)).toEqual(["dry-fruits"]);
    expect(withAncestorIds(["almonds", "kashmir"], all).sort()).toEqual(["almonds", "dry-fruits", "kashmir", "regions"]);
  });

  it("survives cycles", () => {
    const cyc = [cat("a", "b"), cat("b", "a")];
    expect(ancestorsOf("a", cyc).map((c) => c.id)).toEqual(["b"]);
  });

  it("lists children and flattens with depth", () => {
    expect(childrenOf("dry-fruits", all).map((c) => c.id)).toEqual(["cashews", "almonds"]);
    const flat = flattenTree(buildTree(all));
    expect(flat.find((c) => c.id === "almonds")?.depth).toBe(1);
  });
});
