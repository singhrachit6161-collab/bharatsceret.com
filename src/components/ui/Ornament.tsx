/** Gold divider ornament: hairlines with a central lotus-diamond motif. */
export function Ornament({ className = "", tone = "gold" }: { className?: string; tone?: "gold" | "light" }) {
  const c = tone === "light" ? "#DCC08A" : "#B8893B";
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-12 sm:w-20" style={{ background: `linear-gradient(to right, transparent, ${c})` }} />
      <svg width="46" height="14" viewBox="0 0 46 14">
        <path d="M23 1l4 6-4 6-4-6 4-6Z" fill={c} />
        <path d="M13 7c3-3 5-3 6 0-1 3-3 3-6 0Z M33 7c-3-3-5-3-6 0 1 3 3 3 6 0Z" fill="none" stroke={c} strokeWidth="1" />
        <circle cx="5" cy="7" r="1.4" fill={c} />
        <circle cx="41" cy="7" r="1.4" fill={c} />
      </svg>
      <span className="h-px w-12 sm:w-20" style={{ background: `linear-gradient(to left, transparent, ${c})` }} />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  tone = "dark",
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tone?: "dark" | "light";
  id?: string;
}) {
  const light = tone === "light";
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow && <p className={`eyebrow mb-3 ${light ? "text-gold-light" : ""}`}>{eyebrow}</p>}
      <h2 id={id} className={`font-display text-4xl leading-tight font-semibold sm:text-5xl ${light ? "text-ivory" : "text-walnut"}`}>
        {title}
      </h2>
      <Ornament className="mt-4" tone={light ? "light" : "gold"} />
      {subtitle && <p className={`mt-4 text-sm leading-relaxed ${light ? "text-ivory/70" : "text-muted"}`}>{subtitle}</p>}
    </div>
  );
}
