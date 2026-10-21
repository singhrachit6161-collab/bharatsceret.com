"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Ornament } from "@/components/ui/Ornament";
import type { Banner } from "@/lib/types";

export function HeroCarousel({ slides }: { slides: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => clearInterval(t);
  }, [paused, count]);

  if (!count) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className="bg-royal relative overflow-hidden text-ivory"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="container-page relative min-h-[560px] lg:min-h-[620px]">
        {slides.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${s.title}`}
              aria-hidden={!active}
              className={`absolute inset-0 grid items-center gap-8 px-4 pt-12 pb-24 lg:pb-12 transition-opacity duration-1000 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <div className="relative z-10 max-w-xl text-center lg:text-left">
                <p className="eyebrow text-gold-light">The Royal Collection</p>
                <h2 className="mt-5 font-display text-5xl leading-[1.02] font-semibold sm:text-6xl lg:text-7xl">{s.title}</h2>
                <Ornament className="mt-6 lg:justify-start" tone="light" />
                {s.subtitle && <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-ivory/75 lg:mx-0">{s.subtitle}</p>}
                <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
                  {s.cta_label && (
                    <Link href={s.link_url} tabIndex={active ? 0 : -1} className="btn-accent px-8 py-3.5 text-xs uppercase">
                      {s.cta_label}
                    </Link>
                  )}
                  <Link href="/shop" tabIndex={active ? 0 : -1} className="btn border border-gold-light/50 px-8 py-3.5 text-xs tracking-wide text-gold-light uppercase hover:bg-gold-light/10">
                    Explore the collection
                  </Link>
                </div>
              </div>
              <div className="relative mx-auto hidden w-full max-w-[480px] lg:block">
                <div className="arch relative aspect-[4/5] overflow-hidden border border-gold-light/50 p-3 shadow-2xl shadow-black/50">
                  <div className="arch relative h-full w-full overflow-hidden">
                    <picture>
                      {s.mobile_image_url && <source media="(max-width: 640px)" srcSet={s.mobile_image_url} />}
                      <Image
                        src={s.image_url}
                        alt={s.alt}
                        fill
                        priority={i === 0}
                        sizes="480px"
                        unoptimized={s.image_url.endsWith(".svg")}
                        className={`object-cover transition-transform duration-[7000ms] ${active ? "scale-105" : "scale-100"}`}
                      />
                    </picture>
                  </div>
                </div>
                <div className="arch pointer-events-none absolute -inset-4 border border-gold-light/20" />
              </div>
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <div className="container-page absolute inset-x-0 bottom-6 flex items-center justify-between">
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-[3px] rounded-full transition-all ${i === index ? "w-10 bg-gold-light" : "w-5 bg-ivory/30"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className="rounded-full border border-gold-light/40 p-2 text-gold-light hover:bg-gold-light/10">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play slideshow" : "Pause slideshow"} className="rounded-full border border-gold-light/40 p-2 text-gold-light hover:bg-gold-light/10">
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className="rounded-full border border-gold-light/40 p-2 text-gold-light hover:bg-gold-light/10">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
