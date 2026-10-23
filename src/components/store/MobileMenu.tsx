"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface MenuGroup {
  label: string;
  href?: string;
  links: { href: string; label: string }[];
}

export function MobileMenu({ groups }: { groups: MenuGroup[] }) {
  const [open, setOpen] = useState(false);
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
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="p-2 text-walnut lg:hidden">
        <Menu size={24} strokeWidth={1.6} />
      </button>
      {/* Portal to <body>: the sticky header's backdrop-filter would otherwise trap this fixed overlay. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={close} />
          <nav className="absolute inset-y-0 left-0 flex w-84 max-w-[88%] flex-col overflow-y-auto bg-ivory shadow-2xl">
            <div className="bg-royal flex items-center justify-between px-5 py-5">
              <span className="font-display text-2xl font-semibold text-ivory">Bharat Secrets</span>
              <button type="button" onClick={close} aria-label="Close menu" className="p-1 text-gold-light">
                <X size={22} />
              </button>
            </div>
            <ul className="divide-y divide-line px-2 py-2">
              {groups.map((g) =>
                g.links.length ? (
                  <li key={g.label}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3.5 font-display text-xl font-semibold text-walnut">
                        {g.label}
                        <ChevronDown size={18} className="text-saffron-600 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <ul className="pb-3">
                        {g.href && (
                          <li>
                            <Link href={g.href} onClick={close} className="block px-5 py-2 text-[11px] font-semibold tracking-[0.2em] text-saffron-600 uppercase">
                              View all {g.label}
                            </Link>
                          </li>
                        )}
                        {g.links.map((l) => (
                          <li key={l.href}>
                            <Link href={l.href} onClick={close} className="block px-5 py-2 text-sm text-ink hover:text-saffron-600">
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ) : g.href ? (
                  <li key={g.label}>
                    <Link href={g.href} onClick={close} className="block px-3 py-3.5 font-display text-xl font-semibold text-walnut">
                      {g.label}
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
