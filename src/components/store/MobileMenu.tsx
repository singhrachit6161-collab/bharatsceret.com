"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="p-2 text-walnut lg:hidden">
        <Menu size={24} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col overflow-y-auto bg-ivory shadow-xl">
            <div className="flex items-center justify-between border-b border-line p-4">
              <span className="font-display text-xl font-semibold text-walnut">Menu</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="p-1 text-walnut">
                <X size={22} />
              </button>
            </div>
            <ul className="p-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block rounded-md px-3 py-3 text-sm font-medium text-ink hover:bg-almond-100">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
