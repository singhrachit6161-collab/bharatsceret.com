"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Banner } from "@/lib/types";

const THEMES: Record<Banner["theme"], { bg: string; text: string; accent: string }> = {
  walnut: { bg: "bg-walnut", text: "text-ivory", accent: "btn-accent" },
  saffron: { bg: "bg-[#7a4f1e]", text: "text-ivory", accent: "btn-accent" },
  olive: { bg: "bg-olive", text: "text-ivory", accent: "btn-accent" },
  cream: { bg: "bg-almond", text: "text-walnut", accent: "btn-primary" },
};

export function HeroCarousel({ slides }: { slides: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [paused, count]);

  if (!count) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotions"
      className="relative overflow-hidden rounded-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[4/3] sm:aspect-[16/7] lg:aspect-[5/2]">
        {slides.map((s, i) => {
          const theme = THEMES[s.theme] ?? THEMES.walnut;
          const active = i === index;
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${s.title}`}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-700 ${theme.bg} ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <picture>
                {s.mobile_image_url && <source media="(max-width: 640px)" srcSet={s.mobile_image_url} />}
                <Image
                  src={s.image_url}
                  alt={s.alt}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  unoptimized={s.image_url.endsWith(".svg")}
                  className="object-cover object-right"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
              <div className={`relative flex h-full max-w-xl flex-col justify-center gap-3 p-6 sm:p-10 lg:p-14 ${theme.text}`}>
                <p className="text-xs font-semibold tracking-[0.25em] text-saffron uppercase">SwaadVana</p>
                <h2 className="text-3xl leading-tight font-semibold sm:text-4xl lg:text-5xl">{s.title}</h2>
                {s.subtitle && <p className="max-w-md text-sm opacity-90 sm:text-base">{s.subtitle}</p>}
                {s.cta_label && (
                  <div className="pt-2">
                    <Link href={s.link_url} tabIndex={active ? 0 : -1} className={theme.accent}>
                      {s.cta_label}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className="rounded-full bg-white/85 p-2 text-walnut hover:bg-white">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play slideshow" : "Pause slideshow"} className="rounded-full bg-white/85 p-2 text-walnut hover:bg-white">
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className="rounded-full bg-white/85 p-2 text-walnut hover:bg-white">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      {count > 1 && (
        <div className="absolute bottom-5 left-6 flex gap-2 sm:left-10 lg:left-14">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-saffron" : "w-2 bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
