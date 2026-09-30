"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cx } from "./cx";

/** Side panel on desktop, full-height sheet on phones. Native <dialog> for focus trap + Esc. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: "right" | "center";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-0 max-h-none max-w-none bg-transparent p-0 text-ink backdrop:bg-[rgb(6_4_5/0.72)] backdrop:backdrop-blur-[3px]",
        side === "right"
          ? "fixed inset-y-0 right-0 left-auto h-dvh w-full sm:w-[min(520px,94vw)] sm:p-3"
          : "fixed inset-0 m-auto h-fit max-h-[92dvh] w-[min(680px,94vw)]",
      )}
    >
      {open && (
        <div
          className={cx(
            "relative flex h-full flex-col overflow-hidden border-line-strong bg-panel shadow-[0_30px_90px_rgb(0_0_0/0.85)]",
            side === "right" ? "sm:rounded-[20px] sm:border" : "max-h-[92dvh] rounded-[20px] border",
            className,
          )}
        >
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(closest-side,rgb(255_43_69/0.16),transparent)] blur-2xl" />
          {children}
        </div>
      )}
    </dialog>
  );
}

export function SheetHeader({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="relative flex items-start justify-between gap-4 px-7 pt-7 pb-5">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
        <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
    </div>
  );
}
