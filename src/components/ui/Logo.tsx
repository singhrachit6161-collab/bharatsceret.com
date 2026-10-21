import Image from "next/image";

/**
 * The Bharat Secrets crest (public/brand/logo.png, transparent background).
 * `size` is the rendered height in pixels; width follows the artwork's aspect ratio.
 */
const RATIO = 442 / 520;

export function Logo({ size = 88, className = "", priority = false }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Bharat Secrets"
      width={Math.round(size * RATIO)}
      height={size}
      priority={priority}
      className={`h-auto select-none ${className}`}
      style={{ height: size, width: "auto" }}
    />
  );
}
