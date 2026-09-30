import { forwardRef } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const buttonBase =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-40 disabled:pointer-events-none [&_svg]:shrink-0";
export const buttonSizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg [&_svg]:size-3.5",
  md: "h-10 px-4 text-sm rounded-[10px] [&_svg]:size-4",
  lg: "h-12 px-6 text-[15px] rounded-xl [&_svg]:size-[18px]",
  icon: "h-9 w-9 rounded-lg [&_svg]:size-4",
};
export const buttonVariants: Record<Variant, string> = {
  primary:
    "bg-neon text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_0_0_1px_rgb(255_43_69/0.9),0_6px_24px_-6px_var(--neon-glow)] hover:bg-[#ff3d55] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_0_0_1px_var(--neon-hot),0_8px_32px_-4px_var(--neon-glow)]",
  secondary: "border border-line-strong bg-surface-2 text-ink hover:bg-surface-3 hover:border-[rgb(255_236_228/0.2)]",
  outline: "border border-line-strong bg-surface-2 text-ink hover:bg-surface-3 hover:border-[rgb(255_236_228/0.2)]",
  subtle: "border border-line-strong bg-surface-2 text-ink hover:bg-surface-3",
  ghost: "text-ink-2 hover:bg-[rgb(255_236_228/0.06)] hover:text-ink",
  danger: "border border-[rgb(255_43_69/0.35)] text-neon-hot hover:bg-[rgb(255_43_69/0.1)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cx(buttonBase, buttonSizes[size], buttonVariants[variant], className)} {...rest} />;
});
