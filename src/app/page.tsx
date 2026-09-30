"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, DatabaseBackup, Lock } from "lucide-react";
import { GENRES } from "@/lib/genres";
import { GENRE_ORDER, type GenreKey } from "@/lib/types";
import { KEYS, useGenre } from "@/lib/state";
import { usePersistent } from "@/lib/storage";
import { Backdrop } from "@/components/shell/Backdrop";
import { Brand } from "@/components/shell/Brand";
import { GENRE_COUNTS } from "@/components/shell/BookSwitcher";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

const TOTAL = Object.values(GENRE_COUNTS).reduce((a, b) => a + b, 0);
/** Tempo buckets every non-jazz book shares; the preview shows the book's own styles instead. */
const SHARED_STYLES = new Set(["bl", "up", "pa"]);

/** A few of the book's styles, as a taste of what's inside. */
function stylePreview(k: GenreKey, n = 4) {
  return Object.entries(GENRES[k].styles)
    .filter(([code]) => k === "jazz" || !SHARED_STYLES.has(code))
    .slice(0, n)
    .map(([, label]) => label);
}

export default function Home() {
  const router = useRouter();
  const [, setGenre] = useGenre();
  // null until this browser has opened a book (useGenre falls back to jazz, which can't tell).
  const [last] = usePersistent<GenreKey | null>(KEYS.genre, null);
  const lastGenre = last && GENRES[last] ? last : null;

  const open = (k: GenreKey) => {
    setGenre(k);
    router.push("/repertoire/");
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <Backdrop home />
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-[1320px] flex-col px-4 pt-5 pb-10 sm:px-8 sm:pt-7">
        {/* a slim bar: the brand, and a way straight back into the last book */}
        <header className="home-bar flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
          <Brand />
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-2 text-[13px] text-muted md:inline-flex">
              <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
              No account. Everything stays in this browser.
            </span>
            {lastGenre && (
              <span data-genre={lastGenre} className="contents">
                <Button variant="primary" onClick={() => open(lastGenre)}>
                  Continue with {GENRES[lastGenre].sign}
                  <ArrowRight strokeWidth={2} />
                </Button>
              </span>
            )}
          </div>
        </header>

        <section aria-labelledby="books-title" className="mt-7 sm:mt-9">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h1 id="books-title" className="font-serif text-[40px] leading-none text-ink sm:text-[52px]">Pick a book</h1>
              <p className="mt-2 text-[15px] text-ink-2">Each one has its own songs, set lists and rules. Mark what you know, then build the night.</p>
            </div>
            <span className="tabular font-mono text-xs text-muted">
              {GENRE_ORDER.length} books · {TOTAL.toLocaleString()} songs
            </span>
          </div>

          <ul className="book-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {GENRE_ORDER.map((k) => {
              const g = GENRES[k];
              const isLast = k === lastGenre;
              return (
                <li key={k}>
                  <button
                    type="button"
                    data-genre={k}
                    onClick={() => open(k)}
                    className={cx(
                      "book-card group flex h-full min-h-[236px] w-full flex-col rounded-2xl border bg-surface/80 p-5 text-left backdrop-blur-sm transition-colors duration-150",
                      isLast ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)]" : "border-line hover:border-line-strong hover:bg-surface-2/80",
                    )}
                  >
                    {isLast && <span className="book-badge mb-2 font-mono text-[10px] font-bold tracking-[0.12em] text-neon-hot uppercase">Last opened</span>}
                    <span className="look-noir font-serif text-[32px] leading-[1.02] text-ink">{g.sign}</span>
                    <span className="not-noir sign-dim block text-[34px] leading-[1.02] break-words">{g.sign}</span>

                    <span className="mt-3 line-clamp-3 text-[14px] leading-snug text-ink-2">{g.tagline}</span>

                    <span className="mt-4 flex flex-wrap gap-1.5">
                      {stylePreview(k).map((s) => (
                        <span key={s} className="book-style inline-flex h-6 items-center rounded-md bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 text-[11.5px] text-[color-mix(in_srgb,var(--accent)_75%,var(--ink))]">
                          {s}
                        </span>
                      ))}
                    </span>

                    <span className="book-foot mt-auto flex items-center justify-between gap-3 border-t border-line pt-3.5">
                      <span className="book-count tabular font-mono text-[11px] text-muted">
                        {GENRE_COUNTS[k].toLocaleString()} {g.noun}s
                      </span>
                      <span className="book-open inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 transition-colors group-hover:text-ink">
                        {isLast ? "Continue" : "Open"}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-12 text-xs text-faint">
          <span>The Gig Book · made for the bandstand</span>
          <Link href="/backup/" className="inline-flex items-center gap-1.5 transition-colors hover:text-ink-2">
            <DatabaseBackup className="h-3.5 w-3.5" strokeWidth={1.75} />
            Back up your book
          </Link>
        </footer>
      </main>
    </div>
  );
}
