import type { Category } from "@/lib/types";

/** Pure helpers for the nested catalogue (parent_id tree). */

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export function buildTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const c of categories) byId.set(c.id, { ...c, children: [] });
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: CategoryNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const n of list) sort(n.children);
  };
  sort(roots);
  return roots;
}

/** Ancestors from the root down to (but excluding) the category itself. Cycle-safe. */
export function ancestorsOf(categoryId: string, categories: Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: Category[] = [];
  const seen = new Set<string>([categoryId]);
  let current = byId.get(categoryId)?.parent_id ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    const c = byId.get(current);
    if (!c) break;
    chain.unshift(c);
    current = c.parent_id;
  }
  return chain;
}

/** The given ids plus all of their ancestors (used for coupon category eligibility). */
export function withAncestorIds(ids: string[], categories: Category[]): string[] {
  const out = new Set(ids);
  for (const id of ids) for (const a of ancestorsOf(id, categories)) out.add(a.id);
  return [...out];
}

export function childrenOf(categoryId: string, categories: Category[]): Category[] {
  return categories
    .filter((c) => c.parent_id === categoryId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/** Flatten for <select>/checkbox lists: depth-first with depth for indentation. */
export function flattenTree(nodes: CategoryNode[], depth = 0): (Category & { depth: number })[] {
  return nodes.flatMap(({ children, ...c }) => [{ ...c, depth }, ...flattenTree(children, depth + 1)]);
}
