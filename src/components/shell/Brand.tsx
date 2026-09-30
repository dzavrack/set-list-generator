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

export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={size === "lg" ? "h-12 w-12" : "h-8 w-8"} />
      <span className={cx("neon font-neon leading-none", size === "lg" ? "text-5xl" : "text-[27px]")}>Gig Book</span>
    </span>
  );
}
