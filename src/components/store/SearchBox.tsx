"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

interface Suggestion {
  name: string;
  slug: string;
}

export function SearchBox({ categories }: { categories: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: abort.current.signal });
        if (res.ok) {
          setResults((await res.json()).items ?? []);
          setOpen(true);
          setActive(-1);
        }
      } catch {
        /* aborted */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const items = q.trim().length < 2 ? [] : results;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) {
      router.push(`/product/${items[active].slug}`);
    } else {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      router.push(`/search?${params.toString()}`);
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <form role="search" onSubmit={submit} className="relative flex w-full">
      <label htmlFor="site-search-category" className="sr-only">
        Category
      </label>
      <select
        id="site-search-category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="hidden rounded-l-md border border-r-0 border-walnut/25 bg-almond-100 px-3 text-xs text-walnut focus:outline-none md:block"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <input
        id="site-search"
        type="search"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Search almonds, cashews, gift hampers…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full min-w-0 border border-walnut/25 bg-white px-3 py-2 text-sm focus:border-saffron focus:outline-none max-md:rounded-l-md"
      />
      <button type="submit" aria-label="Search" className="rounded-r-md bg-walnut px-4 text-ivory hover:bg-walnut-700">
        <Search size={18} />
      </button>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border border-line bg-white shadow-lg">
          {items.map((it, i) => (
            <li key={it.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <Link
                href={`/product/${it.slug}`}
                className={`block px-4 py-2 text-sm ${i === active ? "bg-almond-100" : "hover:bg-almond-100"}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen(false)}
              >
                {it.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
