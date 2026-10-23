"use client";

import { useState } from "react";
import { ProductImage } from "@/components/ui/ProductImage";
import type { ProductImage as Img } from "@/lib/types";

export function ProductGallery({ images, name }: { images: Img[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index];
  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-almond-100">
        <ProductImage src={current?.url} alt={current?.alt || name} priority sizes="(min-width: 1024px) 50vw, 100vw" />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                className={`relative block h-20 w-20 overflow-hidden rounded-md border-2 ${i === index ? "border-walnut" : "border-transparent"}`}
              >
                <ProductImage src={img.url} alt="" sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
