"use client";

import Image from "next/image";
import { useState } from "react";

const FALLBACK = "/placeholders/product.svg";

/** next/image wrapper with a fixed aspect ratio box and a fallback for broken images. */
export function ProductImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  priority = false,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = !src || failed ? FALLBACK : src;
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={url.endsWith(".svg")}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
