import { cx } from "@/components/ui/cx";

/** Neon mark: a bent-glass eighth note, lit. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("h-7 w-7 overflow-visible", className)} aria-hidden fill="none">
      <g className="[filter:drop-shadow(0_0_2px_var(--neon-hot))_drop-shadow(0_0_7px_var(--neon))_drop-shadow(0_0_16px_var(--neon-glow))]">
        <path d="M13 23.5V6.5c4.5 1.2 8.2 3.4 9.5 7.5" stroke="var(--neon-core)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx="9.2" cy="23.8" rx="4" ry="3.1" transform="rotate(-18 9.2 23.8)" stroke="var(--neon-core)" strokeWidth="2.2" />
      </g>
    </svg>
  );
}

/**
 * The brand. In the Marquee look, pass `sign` to show the open book's own sign instead
 * ("Juke Joint", "Honky Tonk"...) in that genre's typeface, as the reference app does.
 */
export function Brand({ size = "md", sign }: { size?: "sm" | "md" | "lg"; sign?: string }) {
  const text = { sm: "text-lg", md: "text-[27px]", lg: "text-5xl" }[size];
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark className={cx({ sm: "h-6 w-6", md: "h-8 w-8", lg: "h-12 w-12" }[size], sign && "look-noir", "not-sleeve")} />
      <span className={cx("neon brand-text font-neon leading-none", text, sign && "look-noir")}>Gig Book</span>
      {sign && (
        <span className={cx("look-marquee min-w-0 leading-[1.05]", size === "sm" ? "sign-dim -my-1 truncate py-1 text-[21px]" : "sign text-[30px]")}>{sign}</span>
      )}
      {sign && <span className="look-sleeve brand-sleeve min-w-0 truncate">{sign}</span>}
    </span>
  );
}
