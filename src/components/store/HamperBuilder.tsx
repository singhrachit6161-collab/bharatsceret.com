"use client";

import { Check, Minus, Plus, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addHamperToCart } from "@/app/actions/cart";
import { ProductImage } from "@/components/ui/ProductImage";
import { formatINR } from "@/lib/money";
import { hamperUnits, validateHamper } from "@/lib/hamper";

export interface BuilderBox {
  variantId: string;
  name: string;
  description: string | null;
  capacity: number;
  pricePaise: number;
  available: number;
  imageUrl: string | null;
}

export interface BuilderItem {
  variantId: string;
  name: string;
  label: string;
  pricePaise: number;
  available: number;
  maxPerOrder: number;
  imageUrl: string | null;
  collection: string;
}

const STEPS = ["Choose your box", "Fill it with treasures", "Add a personal touch"] as const;
const NUMERALS = ["I", "II", "III"] as const;

function StepHeading({ index, id, title, note, aside }: { index: 0 | 1 | 2; id: string; title: string; note: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-saffron/25 pb-5">
      <Image src={`/brand/hamper/step-${index + 1}.webp`} alt="" width={72} height={72} className="h-16 w-16 shrink-0 drop-shadow-lg sm:h-[72px] sm:w-[72px]" />
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-saffron-600">Step {NUMERALS[index]}</p>
        <h2 id={id} className="font-display text-3xl leading-tight font-semibold text-walnut sm:text-4xl">{title}</h2>
        <p className="mt-1 text-sm text-muted">{note}</p>
      </div>
      {aside}
    </div>
  );
}

export function HamperBuilder({
  boxes,
  items,
  minItems,
  messageMax,
  recipientMax,
}: {
  boxes: BuilderBox[];
  items: BuilderItem[];
  minItems: number;
  messageMax: number;
  recipientMax: number;
}) {
  const router = useRouter();
  const [boxId, setBoxId] = useState<string | null>(boxes.find((b) => b.available > 0)?.variantId ?? null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const box = boxes.find((b) => b.variantId === boxId) ?? null;
  const byId = useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  const chosen = Object.entries(picked)
    .filter(([, q]) => q > 0)
    .map(([variantId, quantity]) => ({ item: byId.get(variantId)!, quantity }))
    .filter((c) => c.item);
  const units = hamperUnits(chosen);
  const capacity = box?.capacity ?? 0;
  const itemsTotal = chosen.reduce((n, c) => n + c.item.pricePaise * c.quantity, 0);
  const total = (box?.pricePaise ?? 0) + itemsTotal;

  const collections = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.collection)))], [items]);
  const visible = items.filter(
    (i) =>
      (tab === "All" || i.collection === tab) &&
      (!query.trim() || `${i.name} ${i.label}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const problem = box
    ? validateHamper(
        { capacity, minItems },
        chosen.map((c) => ({
          variantId: c.item.variantId,
          quantity: c.quantity,
          available: c.item.available,
          maxPerOrder: c.item.maxPerOrder,
          eligible: true,
        })),
      )
    : "Choose a box to begin.";

  const change = (variantId: string, delta: number) => {
    setError(null);
    setPicked((p) => {
      const item = byId.get(variantId);
      if (!item) return p;
      const current = p[variantId] ?? 0;
      const next = Math.max(0, Math.min(current + delta, item.available, item.maxPerOrder));
      if (delta > 0 && units >= capacity) return p;
      return { ...p, [variantId]: next };
    });
  };

  const submit = () => {
    if (!box || problem) return;
    setError(null);
    start(async () => {
      const res = await addHamperToCart({
        boxVariantId: box.variantId,
        items: chosen.map((c) => ({ variantId: c.item.variantId, quantity: c.quantity })),
        recipient,
        message,
      });
      if (res.ok) router.push("/cart");
      else setError(res.error);
    });
  };

  // Slots for the live preview: one tile per unit, empty tiles for the rest.
  const slots = chosen.flatMap((c) => Array.from({ length: c.quantity }, () => c.item));
  const step = !box ? 0 : units < Math.min(minItems, capacity) ? 1 : 2;

  return (
    <div className="grid gap-10 pb-20 lg:grid-cols-[1fr_380px] lg:pb-0">
      <div className="min-w-0 space-y-12">
        <ol className="grid grid-cols-3 gap-2 bg-royal p-2 shadow-xl shadow-walnut/20" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? "step" : undefined}
              className={`flex items-center justify-center gap-2 px-2 py-3 text-center text-[10px] font-semibold tracking-[0.16em] uppercase transition sm:text-[11px] ${
                i === step ? "bg-gradient-to-r from-saffron to-gold-light text-walnut" : i < step ? "text-gold-light" : "text-ivory/45"
              }`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-display text-sm normal-case tracking-normal ${i === step ? "border-walnut/40" : "border-gold-light/40"}`}>
                {i < step ? <Check size={12} aria-hidden="true" /> : NUMERALS[i]}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </li>
          ))}
        </ol>

        {/* Step 1 */}
        <section aria-labelledby="step-box">
          <StepHeading index={0} id="step-box" title="Choose your keepsake box" note="Each box is made to be kept long after the treasures inside are gone." />
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {boxes.map((b) => {
              const active = b.variantId === boxId;
              const soldOut = b.available < 1;
              return (
                <button
                  key={b.variantId}
                  type="button"
                  disabled={soldOut}
                  aria-pressed={active}
                  onClick={() => {
                    setBoxId(b.variantId);
                    setError(null);
                  }}
                  className={`group text-left transition ${soldOut ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span className={`arch relative block aspect-[4/5] overflow-hidden border p-1.5 transition ${active ? "border-saffron shadow-xl shadow-walnut/20 ring-2 ring-saffron" : "border-line group-hover:border-saffron/60"}`}>
                    <span className="arch relative block h-full w-full overflow-hidden">
                      <ProductImage src={b.imageUrl} alt={b.name} sizes="(min-width: 640px) 25vw, 90vw" className="transition-transform duration-500 group-hover:scale-105" />
                    </span>
                    {active && (
                      <span className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-emerald text-gold-light shadow-lg">
                        <Check size={16} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="mt-4 block text-center">
                    <span className="block text-[10px] font-semibold tracking-[0.28em] text-saffron-600 uppercase">Holds {b.capacity} treasures</span>
                    <span className="mt-1 block font-display text-2xl font-semibold text-walnut">{b.name}</span>
                    <span className="mx-auto mt-2 block h-px w-12 bg-gradient-to-r from-transparent via-saffron to-transparent" aria-hidden="true" />
                    <span className="mt-2 block text-sm font-semibold text-walnut/80">{soldOut ? "Sold out" : formatINR(b.pricePaise)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2 */}
        <section aria-labelledby="step-fill" className={box ? "" : "pointer-events-none opacity-40"}>
          <StepHeading
            index={1}
            id="step-fill"
            title="Fill it with treasures"
            note="Dry fruits, spices, teas and pantry favourites from across Bharat."
            aside={
              <p className="border border-saffron/40 bg-white/60 px-4 py-2 text-center font-display text-2xl font-semibold text-walnut" aria-live="polite">
                {units}<span className="text-base text-muted"> / {capacity || "–"}</span>
              </p>
            }
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="no-scrollbar flex max-w-full min-w-0 gap-2 overflow-x-auto" role="tablist" aria-label="Collections">
              {collections.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={tab === c}
                  onClick={() => setTab(c)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.12em] uppercase ${tab === c ? "border-walnut bg-walnut text-gold-light" : "border-saffron/40 text-walnut hover:border-saffron"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="relative ml-auto w-full sm:w-60">
              <span className="sr-only">Search items</span>
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items…" className="input rounded-full pl-9" />
            </label>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:max-h-[860px] lg:overflow-y-auto lg:pr-2 lg:[scrollbar-gutter:stable]">
            {visible.map((i) => {
              const q = picked[i.variantId] ?? 0;
              const max = Math.min(i.available, i.maxPerOrder);
              const soldOut = max < 1;
              const full = units >= capacity;
              return (
                <li key={i.variantId} className={`flex flex-col bg-white/70 ring-1 transition ${q > 0 ? "ring-2 ring-saffron" : "ring-line"}`}>
                  <div className="relative aspect-square overflow-hidden bg-almond-100">
                    <ProductImage src={i.imageUrl} alt={i.name} sizes="(min-width: 768px) 20vw, 45vw" />
                    {q > 0 && <span className="absolute top-2 left-2 bg-emerald px-2 py-0.5 text-[11px] font-bold text-gold-light">× {q}</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-3 text-center">
                    <p className="text-[10px] font-semibold tracking-[0.22em] text-saffron-600 uppercase">{i.label}</p>
                    <p className="mt-1 line-clamp-2 font-display text-lg leading-tight font-semibold text-walnut">{i.name}</p>
                    <p className="mt-auto pt-2 text-sm font-semibold">{formatINR(i.pricePaise)}</p>
                    <div className="mt-2">
                      {soldOut ? (
                        <p className="py-2 text-xs font-semibold tracking-[0.18em] text-muted uppercase">Sold out</p>
                      ) : q === 0 ? (
                        <button type="button" disabled={full || !box} onClick={() => change(i.variantId, 1)} className="btn-outline w-full rounded-none py-2 text-[11px] tracking-[0.18em] uppercase">
                          {full ? "Box is full" : "Add"}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between border border-walnut/20">
                          <button type="button" onClick={() => change(i.variantId, -1)} aria-label={`Remove one ${i.name}`} className="p-2 text-walnut hover:bg-almond-100">
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-semibold" aria-live="polite">{q}</span>
                          <button type="button" disabled={full || q >= max} onClick={() => change(i.variantId, 1)} aria-label={`Add one more ${i.name}`} className="p-2 text-walnut hover:bg-almond-100 disabled:opacity-30">
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {!visible.length && <li className="col-span-full py-10 text-center text-sm text-muted">No items match.</li>}
          </ul>
        </section>

        {/* Step 3 */}
        <section aria-labelledby="step-note" className={box ? "" : "pointer-events-none opacity-40"}>
          <StepHeading index={2} id="step-note" title="Add a personal touch" note="A few words from you, on a keepsake card inside the box." />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label htmlFor="h-recipient" className="label">For (optional)</label>
                <input id="h-recipient" value={recipient} maxLength={recipientMax} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Nani & Nana" className="input" />
              </div>
              <div>
                <label htmlFor="h-message" className="label">Gift message (optional)</label>
                <textarea id="h-message" value={message} maxLength={messageMax} rows={5} onChange={(e) => setMessage(e.target.value)} placeholder="Wishing you a joyous Diwali filled with light and sweetness…" className="input" />
                <p className="mt-1 text-right text-xs text-muted">{message.length}/{messageMax}</p>
              </div>
              <p className="text-xs text-muted">Your message is included on a card inside the box. Prices are never shown on the card.</p>
            </div>
            <figure className="relative aspect-[25/16] w-full -rotate-1 shadow-2xl shadow-walnut/25 transition hover:rotate-0" aria-label="Card preview">
              <Image src="/brand/hamper/gift-card.webp" alt="" fill sizes="(min-width: 768px) 30vw, 90vw" className="object-cover" />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-[14%] pt-[6%] text-center text-walnut">
                <p className="eyebrow text-saffron-600">{recipient.trim() ? `For ${recipient.trim()}` : "A gift for you"}</p>
                <p className="mt-3 line-clamp-5 font-display text-lg leading-snug whitespace-pre-line italic sm:text-xl">
                  {message.trim() || "Your message will appear here."}
                </p>
                <p className="mt-3 text-[9px] tracking-[0.34em] text-saffron-600/80 uppercase">Bharat Secrets</p>
              </div>
            </figure>
          </div>
        </section>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-56 lg:self-start" aria-labelledby="preview-title">
        <div className="bg-royal gold-frame p-6 text-ivory shadow-2xl shadow-walnut/30">
          <p className="eyebrow text-gold-light">Your hamper</p>
          <h2 id="preview-title" className="mt-1 font-display text-2xl font-semibold">{box ? box.name : "Choose a box"}</h2>
          {box && (
            <>
              <div className="mt-5 grid grid-cols-3 gap-2 border border-gold-light/40 bg-black/25 p-2.5 shadow-[inset_0_0_24px_rgba(0,0,0,0.5)]" aria-label={`${units} of ${capacity} slots filled`}>
                {Array.from({ length: capacity }, (_, k) => {
                  const it = slots[k];
                  return (
                    <div
                      key={k}
                      className={`relative aspect-square overflow-hidden rounded-sm border ${
                        it ? "border-gold-light/70 bg-ivory shadow-md shadow-black/40" : "border-gold-light/20 bg-[radial-gradient(circle_at_50%_35%,#14634b,#06231b)] shadow-[inset_0_3px_8px_rgba(0,0,0,0.55)]"
                      }`}
                    >
                      {it ? <ProductImage src={it.imageUrl} alt={it.name} sizes="100px" /> : <span className="absolute inset-0 flex items-center justify-center font-display text-sm text-gold-light/30">{k + 1}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-saffron to-gold-light transition-all" style={{ width: `${Math.min(100, (units / Math.max(1, capacity)) * 100)}%` }} />
              </div>
              <dl className="mt-5 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ivory/70">{box.name}</dt><dd>{formatINR(box.pricePaise)}</dd></div>
                {chosen.map((c) => (
                  <div key={c.item.variantId} className="flex justify-between gap-3">
                    <dt className="text-ivory/70">{c.quantity} × {c.item.name}</dt>
                    <dd className="shrink-0">{formatINR(c.item.pricePaise * c.quantity)}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-gold-light/25 pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="text-gold-light">{formatINR(total)}</dd>
                </div>
              </dl>
            </>
          )}
          <p className="mt-4 min-h-5 text-xs text-ivory/70" aria-live="polite">{error ?? (problem && box ? problem : box ? "Ready when you are." : "")}</p>
          <button type="button" onClick={submit} disabled={!box || Boolean(problem) || pending} className="btn-accent mt-3 w-full py-3.5 text-xs uppercase disabled:opacity-50">
            {pending ? "Adding…" : "Add hamper to bag"}
          </button>
          <p className="mt-3 text-center text-[11px] text-ivory/50">Stock and prices are re-checked at checkout.</p>
        </div>
      </aside>

      {/* Mobile summary bar */}
      {box && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-light/30 bg-walnut px-4 py-3 text-ivory shadow-2xl lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ivory/70">{units} / {capacity} items · {box.name}</p>
              <p className="font-semibold text-gold-light">{formatINR(total)}</p>
            </div>
            <button type="button" onClick={submit} disabled={Boolean(problem) || pending} className="btn-accent shrink-0 px-5 py-3 text-[11px] uppercase disabled:opacity-50">
              {pending ? "Adding…" : "Add to bag"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
