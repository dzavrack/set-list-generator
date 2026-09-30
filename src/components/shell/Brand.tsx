import { cx } from "@/components/ui/cx";

/**
 * The brand: "Gig Book" in the display face, or, with `sign`, the open book's title
 * ("Jazz Book") as printed across the top bar on phones.
 */
export function Brand({ size = "md", sign }: { size?: "sm" | "md" | "lg"; sign?: string }) {
  if (sign) return <span className="brand-sleeve min-w-0 truncate">{sign}</span>;
  return <span className={cx("brand-text leading-none", { sm: "text-lg", md: "text-[27px]", lg: "text-5xl" }[size])}>Gig Book</span>;
}
