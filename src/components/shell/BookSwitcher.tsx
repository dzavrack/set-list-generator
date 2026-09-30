"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { GENRES } from "@/lib/genres";
import { GENRE_ORDER, type GenreKey } from "@/lib/types";
import { useGenre } from "@/lib/state";
import { cx } from "@/components/ui/cx";

export const GENRE_COUNTS: Record<GenreKey, number> = {
  jazz: 1114, blues: 345, country: 389, rock: 494, pop: 381, rnb: 330,
  folk: 264, gospel: 233, latin: 228, reggae: 158, hiphop: 211, wedding: 351,
};

function Monogram({ k, className }: { k: GenreKey; className?: string }) {
  const name = GENRES[k].name;
  const letters = name.replace(/[^A-Za-z&]/g, "").slice(0, 2);
  return (
    <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2 font-mono text-[11px] font-semibold tracking-wider text-ink-2 uppercase", className)}>
      {letters}
    </span>
  );
}

/** Which genre book you're in. Styled like a workspace switcher. */
export function BookSwitcher({ compact }: { compact?: boolean }) {
  const [genre, setGenre] = useGenre();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const g = GENRES[genre];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  // Arrow keys move between books; Tab away closes the menu.
  const onMenuKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const opts = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    const i = opts.indexOf(document.activeElement as HTMLButtonElement);
    const go = (n: number) => { e.preventDefault(); opts[(n + opts.length) % opts.length]?.focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(opts.length - 1);
  };
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')?.focus();
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Book: ${g.name}. Change book`}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex w-full items-center gap-3 rounded-xl border border-line-strong bg-surface/70 text-left backdrop-blur-sm transition-colors hover:border-[rgb(255_236_228/0.2)] hover:bg-surface-2/80",
          compact ? "p-1.5 pr-2.5" : "p-2.5",
        )}
      >
        <Monogram k={genre} className={compact ? "h-7 w-7 text-[10px]" : undefined} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ink">{g.name}</span>
          {!compact && <span className="block text-xs text-muted">{GENRE_COUNTS[genre].toLocaleString()} {g.noun}s</span>}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Choose a book"
          onKeyDown={onMenuKey}
          className="absolute top-full left-0 z-50 mt-2 max-h-[70dvh] w-[min(280px,90vw)] overflow-y-auto rounded-xl border border-line-strong bg-surface-2/95 p-1.5 shadow-[0_24px_60px_rgb(0_0_0/0.75)] backdrop-blur-xl"
        >
          <li className="label px-2.5 pt-1.5 pb-2">Books</li>
          {GENRE_ORDER.map((k) => (
            <li key={k}>
              <button
                role="option"
                aria-selected={k === genre}
                type="button"
                onClick={() => {
                  setGenre(k);
                  setOpen(false);
                }}
                className={cx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-3", k === genre && "bg-surface-3/60")}
              >
                <Monogram k={k} className="h-7 w-7 text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{GENRES[k].name}</span>
                  <span className="block text-[11px] text-muted">{GENRE_COUNTS[k].toLocaleString()} {GENRES[k].noun}s</span>
                </span>
                {k === genre && <Check className="h-4 w-4 text-neon-hot" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
