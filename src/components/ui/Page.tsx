import { cx } from "./cx";

/** Page title block: big serif title, one-line description, actions on the right. */
export function PageHeader({ title, description, actions, eyebrow, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode; className?: string }) {
  return (
    <header className={cx("flex flex-wrap items-end justify-between gap-x-8 gap-y-5", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="label mb-3">{eyebrow}</p>}
        <h1 className="font-serif text-[44px] leading-[0.95] tracking-[-0.01em] text-ink sm:text-[56px]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[15px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-line bg-surface/80", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 border-b border-line px-6 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-medium text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** A number tile, like a dashboard KPI. Clickable when onClick is set. */
export function StatCard({ label, value, sub, active, onClick, dot, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; active?: boolean; onClick?: () => void; dot?: string; className?: string }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cx(
        "relative flex min-w-0 flex-col items-start rounded-2xl border bg-surface/80 px-5 py-4 text-left transition-colors sm:px-6 sm:py-5",
        active ? "border-[rgb(255_43_69/0.55)] shadow-[0_0_0_1px_rgb(255_43_69/0.25),0_0_28px_-8px_var(--neon-glow)]" : "border-line",
        onClick && !active && "hover:border-line-strong hover:bg-surface-2/80",
        className,
      )}
    >
      <span className={cx("flex items-center gap-2 text-sm", active ? "text-ink" : "text-ink-2")}>
        {dot && <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />}
        {label}
      </span>
      <span className="tabular mt-2 text-[34px] leading-none font-medium tracking-tight text-ink">{value}</span>
      {sub && <span className="mt-2.5 text-[13px] text-muted">{sub}</span>}
    </Comp>
  );
}

/** Underline tabs, like the reference app. */
export function Tabs<T extends string>({ value, onChange, tabs, label, className, right }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: React.ReactNode }[]; label: string; className?: string; right?: React.ReactNode }) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-3 border-b border-line", className)}>
      <div role="tablist" aria-label={label} className="-mb-px flex gap-7">
        {tabs.map((t) => {
          const on = t.value === value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => onChange(t.value)}
              className={cx("relative pb-3.5 text-[15px] transition-colors", on ? "text-ink" : "text-muted hover:text-ink-2")}
            >
              {t.label}
              {on && <span className="tube-h absolute inset-x-0 -bottom-px" />}
            </button>
          );
        })}
      </div>
      {right && <div className="pb-2.5">{right}</div>}
    </div>
  );
}
