import { useId } from "react";

/** Bharat Secret monogram: "BS" set inside a gold arch, a nod to Indian jharokha windows. */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#96701F" />
          <stop offset="0.5" stopColor="#E3C88F" />
          <stop offset="1" stopColor="#B8893B" />
        </linearGradient>
      </defs>
      <path d="M24 2.5c6.5 4.2 13 6 19 6.5v24.5c0 6-8.5 10.6-19 12.5C13.5 44.1 5 39.5 5 33.5V9c6-.5 12.5-2.3 19-6.5Z" fill="none" stroke={`url(#g${id})`} strokeWidth="1.6" />
      <path d="M24 6.5c5.3 3.2 10.6 4.7 15.5 5.2v21.5c0 4.6-7 8.3-15.5 9.9-8.5-1.6-15.5-5.3-15.5-9.9V11.7c4.9-.5 10.2-2 15.5-5.2Z" fill="none" stroke={`url(#g${id})`} strokeWidth="0.6" opacity="0.7" />
      <text x="24" y="31" textAnchor="middle" fontFamily="var(--font-display-serif), Georgia, serif" fontSize="17" fontWeight="600" letterSpacing="-0.5" fill={`url(#g${id})`}>
        BS
      </text>
      <circle cx="24" cy="12.5" r="1.3" fill={`url(#g${id})`} />
    </svg>
  );
}

export function Logo({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  const text = tone === "light" ? "text-ivory" : "text-walnut";
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={compact ? 34 : 42} />
      <span className="flex flex-col leading-none">
        <span className={`font-display font-semibold tracking-[0.18em] whitespace-nowrap uppercase ${compact ? "text-[17px]" : "text-[19px] sm:text-[26px]"} ${text}`}>Bharat Secret</span>
        {!compact && <span className="mt-1 hidden text-[9px] font-medium tracking-[0.42em] text-saffron uppercase sm:block">Fine dry fruits · India</span>}
      </span>
    </span>
  );
}
