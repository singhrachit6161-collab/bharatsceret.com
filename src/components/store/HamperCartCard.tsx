import { Gift } from "lucide-react";
import { ProductImage } from "@/components/ui/ProductImage";
import type { CartViewBundle } from "@/lib/data/cart";
import { formatINR } from "@/lib/money";
import { RemoveHamperButton } from "./RemoveHamperButton";

export function HamperCartCard({ bundle, removable = true }: { bundle: CartViewBundle; removable?: boolean }) {
  return (
    <div className="gold-frame bg-ivory-pattern p-5">
      <div className="relative z-10 flex gap-4">
        <div className="arch relative h-28 w-22 shrink-0 overflow-hidden border border-saffron/50">
          <ProductImage src={bundle.box.imageUrl} alt={bundle.box.name} sizes="88px" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow flex items-center gap-1.5"><Gift size={13} aria-hidden="true" /> Your custom hamper</p>
          <p className="mt-1 font-display text-xl font-semibold text-walnut">{bundle.box.name}</p>
          <p className="text-xs text-muted">
            {bundle.units} of {bundle.capacity} items · box {formatINR(bundle.box.unitPricePaise)}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {bundle.items.map((i) => (
              <li key={i.variantId} className="flex justify-between gap-3">
                <span className={i.issue ? "text-danger" : ""}>
                  {i.quantity} × {i.name} <span className="text-muted">({i.label})</span>
                </span>
                <span className="shrink-0">{formatINR(i.unitPricePaise * i.quantity)}</span>
              </li>
            ))}
          </ul>
          {(bundle.recipient || bundle.message) && (
            <div className="mt-3 border-l-2 border-saffron pl-3 font-display text-base text-walnut italic">
              {bundle.recipient && <p className="not-italic text-xs font-sans font-semibold tracking-[0.18em] text-saffron-600 uppercase">For {bundle.recipient}</p>}
              {bundle.message && <p className="whitespace-pre-line">“{bundle.message}”</p>}
            </div>
          )}
          {bundle.issue && <p className="mt-2 text-xs font-medium text-danger">{bundle.issue}</p>}
          <div className="mt-3 flex items-center justify-between gap-3">
            {removable ? <RemoveHamperButton id={bundle.id} /> : <span />}
            <p className="font-semibold text-walnut">{formatINR(bundle.subtotalPaise)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
