import type { LucideIcon } from "lucide-react";

export function Empty({ title, children, action, icon: Icon }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
      {Icon && (
        <span className="mb-1 grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-surface-2">
          <Icon className="h-5 w-5 text-neon-hot" strokeWidth={1.75} />
        </span>
      )}
      <p className="font-serif text-[28px] leading-tight text-ink">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
