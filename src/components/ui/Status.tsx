import type { Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { cx } from "./cx";

/** Dot styles per status: one red hue at falling intensity, then neutrals. */
export const statusDot: Record<Status, string> = {
  know: "bg-know shadow-[0_0_8px_var(--neon)]",
  shaky: "bg-shaky",
  learn: "bg-learn",
  no: "bg-skip",
};
export const statusText: Record<Status, string> = {
  know: "text-neon-hot",
  shaky: "text-shaky",
  learn: "text-learn",
  no: "text-muted",
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
    <div role="group" aria-label="How well do you know it?" className={cx("inline-flex rounded-[10px] border border-line-strong bg-surface p-[3px]", lg && "flex w-full", className)}>
      {STATUSES.map((s) => {
        const on = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            aria-pressed={on}
            title={`${s.label} (${s.hotkey})`}
            onClick={() => onChange(s.value)}
            className={cx(
              "flex items-center justify-center gap-1.5 rounded-[7px] font-medium whitespace-nowrap transition-colors",
              lg ? "h-11 flex-1 text-sm" : "h-7 px-2.5 text-xs",
              on ? "bg-surface-3 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]" : "text-muted hover:text-ink",
            )}
          >
            <span className={cx("h-1.5 w-1.5 rounded-full transition-opacity", statusDot[s.value], on ? "opacity-100" : "opacity-40")} />
            {lg ? (s.value === "learn" ? "Learn" : s.label) : s.short}
            {lg && <kbd className="ml-0.5 hidden font-mono text-[10px] text-faint xl:inline">{s.hotkey}</kbd>}
          </button>
        );
      })}
    </div>
  );
}

export function StyleTag({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={cx("inline-flex h-5 items-center rounded-md px-1.5 text-[11px] leading-none", active ? "bg-[rgb(255_43_69/0.14)] text-neon-hot" : "bg-[rgb(255_236_228/0.05)] text-muted")}>
      {children}
    </span>
  );
}
