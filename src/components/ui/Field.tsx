import { forwardRef } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cx } from "./cx";

export const inputClass =
  "w-full h-10 rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-faint transition-colors hover:border-[rgb(255_236_228/0.2)] focus:border-[rgb(255_43_69/0.6)] focus:outline-none focus:shadow-[0_0_0_3px_rgb(255_43_69/0.15)]";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputClass, "h-auto py-2.5 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cx("relative inline-flex w-full", className)}>
      <select className={cx(inputClass, "cursor-pointer appearance-none pr-9")} {...rest}>
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" />
    </span>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-50")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-px h-[22px] w-[38px] shrink-0 rounded-full border transition-colors",
          checked ? "border-neon bg-neon shadow-[0_0_14px_-2px_var(--neon-glow)]" : "border-line-strong bg-surface-3",
        )}
      >
        <span className={cx("absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-[left]", checked ? "left-[18px]" : "left-[2px] bg-ink-2")} />
      </button>
      <span className="flex flex-col">
        <span className="text-sm text-ink">{label}</span>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}
