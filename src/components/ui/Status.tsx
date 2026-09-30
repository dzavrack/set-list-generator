import type { Status } from "@/lib/types";
import type { Tone } from "./tone";
import { STATUSES } from "@/lib/types";
import { cx } from "./cx";

/** Dot styles per status: green / gold / blue / red, as in the reference palette. */
export const statusDot: Record<Status, string> = {
  know: "bg-know shadow-[0_0_8px_var(--know)]",
  shaky: "bg-shaky",
  learn: "bg-learn",
  no: "bg-skip",
};
export const statusText: Record<Status, string> = {
  know: "text-know",
  shaky: "text-shaky",
  learn: "text-learn",
  no: "text-skip",
};

/** Know / Shaky / Learn / Skip as a segmented control. */
export function StatusPicker({
  value,
  onChange,
  size = "sm",
  className,
}: {
  value: Status | null | undefined;
  onChange: (s: Status) => void;
  size?: "sm" | "lg";
  className?: string;
}) {
  const lg = size === "lg";
  return (
    <div role="group" aria-label="How well do you know it?" className={cx("inline-flex rounded-control border border-line-strong bg-surface p-[3px]", lg && "status-lg flex w-full", className)}>
      {STATUSES.map((s) => {
        const on = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            aria-pressed={on}
            data-status={s.value}
            title={`${s.label} (${s.hotkey})`}
            onClick={() => onChange(s.value)}
            className={cx(
              "status-btn flex items-center justify-center gap-1.5 rounded-control-sm font-medium whitespace-nowrap transition-colors",
              lg ? "h-12 min-w-0 flex-1 flex-col gap-0.5 px-1 text-[13.5px] font-semibold sm:h-14 sm:text-[15px]" : "h-7 px-2.5 text-xs",
              on ? "bg-surface-3 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]" : "text-muted hover:text-ink",
            )}
          >
            {lg ? (
              <>
                <span className="truncate">{s.value === "learn" ? "Learn" : s.label}</span>
                <kbd className="status-key hidden font-mono text-[10px] font-normal tracking-normal normal-case opacity-60 sm:block">key {s.hotkey}</kbd>
              </>
            ) : (
              <>
                <span className={cx("h-1.5 w-1.5 rounded-full transition-opacity", statusDot[s.value], on ? "opacity-100" : "opacity-40")} />
                {s.short}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A small tag. `tone` colours it by status (e.g. a gold "Shaky" flag in a set list). */
export function StyleTag({ children, active, tone }: { children: React.ReactNode; active?: boolean; tone?: Tone }) {
  if (tone)
    return (
      <span data-tone={tone} className="inline-flex h-5 items-center rounded-md border border-[color-mix(in_srgb,var(--tone)_55%,transparent)] bg-[color-mix(in_srgb,var(--tone)_10%,transparent)] px-1.5 font-mono text-[10px] font-bold tracking-[0.08em] text-[var(--tone)] uppercase leading-none">
        {children}
      </span>
    );
  return (
    <span className={cx("inline-flex h-5 items-center rounded-md px-1.5 text-[11px] leading-none", active ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-neon-hot" : "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] text-muted")}>
      {children}
    </span>
  );
}

const BAR_COLOUR: Record<Status, string> = { know: "var(--know)", shaky: "var(--shaky)", learn: "var(--learn)", no: "var(--skip)" };

/** The sorted bar from the reference: one glowing segment per status, unsorted left dark. */
export function StatusBar({ counts, total, className }: { counts: Record<Status, number>; total: number; className?: string }) {
  return (
    <div className={cx("status-bar h-1", className)} role="img" aria-label={STATUSES.map((s) => `${counts[s.value]} ${s.label.toLowerCase()}`).join(", ")}>
      {total > 0 &&
        STATUSES.map((s) => (
          <i key={s.value} style={{ width: `${(counts[s.value] / total) * 100}%`, background: BAR_COLOUR[s.value], color: BAR_COLOUR[s.value] }} />
        ))}
    </div>
  );
}
