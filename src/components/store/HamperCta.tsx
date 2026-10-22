import Image from "next/image";
import Link from "next/link";
import { Ornament } from "@/components/ui/Ornament";

/** Invitation to the Build Your Own Hamper atelier (used on gifting pages). */
export function HamperCta() {
  return (
    <section aria-labelledby="hamper-cta" className="container-page pt-10">
      <Link href="/build-your-hamper" className="bg-royal gold-frame group relative grid overflow-hidden text-ivory sm:grid-cols-[1fr_280px]">
        <div className="relative z-10 p-8 sm:p-10">
          <p className="eyebrow text-gold-light">The gifting atelier</p>
          <h2 id="hamper-cta" className="mt-2 font-display text-4xl font-semibold">Build your own hamper</h2>
          <Ornament className="mt-4 sm:justify-start" tone="light" />
          <p className="mt-4 max-w-md text-sm text-ivory/75">Choose a keepsake box, fill it with treasures from across Bharat and add a message from the heart.</p>
          <span className="btn-accent mt-6 px-7 py-3 text-xs uppercase">Start creating →</span>
        </div>
        <div className="relative hidden min-h-56 sm:block">
          <Image src="/brand/products/carved-casket.webp" alt="" fill sizes="280px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        </div>
      </Link>
    </section>
  );
}
