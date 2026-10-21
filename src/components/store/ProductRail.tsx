"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

/** Horizontally scrollable row (carousel) with accessible previous/next controls. */
export function ProductRail({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-2"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label={`Scroll ${label} left`}
        className="absolute top-1/3 -left-3 hidden h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-walnut shadow-md hover:bg-almond-100 md:flex"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label={`Scroll ${label} right`}
        className="absolute top-1/3 -right-3 hidden h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-walnut shadow-md hover:bg-almond-100 md:flex"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

export function RailItem({ children }: { children: React.ReactNode }) {
  return <div className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%] xl:w-[18.8%]">{children}</div>;
}
