"use client";
import { LOOKS, useLook } from "@/lib/state";
import { Segmented } from "@/components/ui/Segmented";
import { cx } from "@/components/ui/cx";

/** Switches the overall look. Colours still follow the open book. */
export function LookSwitch({ className }: { className?: string }) {
  const [look, setLook] = useLook();
  return (
    <div className={cx("flex items-center justify-between gap-3", className)}>
      <span className="label">Look</span>
      <Segmented label="Look" size="sm" value={look} options={LOOKS} onChange={setLook} />
    </div>
  );
}
