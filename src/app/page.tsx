"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, DatabaseBackup, Lock } from "lucide-react";
import { GENRES } from "@/lib/genres";
import { GENRE_ORDER, type GenreKey } from "@/lib/types";
import { KEYS, useGenre } from "@/lib/state";
import { usePersistent } from "@/lib/storage";
import { NoirBackdrop } from "@/components/shell/NoirBackdrop";
import { Brand } from "@/components/shell/Brand";
import { GENRE_COUNTS } from "@/components/shell/BookSwitcher";
import { Button, buttonBase, buttonSizes, buttonVariants } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

const TOTAL = Object.values(GENRE_COUNTS).reduce((a, b) => a + b, 0);

function Monogram({ k }: { k: GenreKey }) {
  const letters = GENRES[k].name.replace(/[^A-Za-z&]/g, "").slice(0, 2);
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-line-strong bg-surface-2 font-mono text-xs font-semibold tracking-wider text-ink-2 uppercase transition-colors group-hover:border-[rgb(255_236_228/0.2)] group-hover:text-ink">
      {letters}
    </span>
  );
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
      <NoirBackdrop />
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-[1440px] flex-col px-4 pt-8 pb-12 sm:px-8 sm:pt-12 lg:pr-14 lg:pl-[320px]">
        <header className="flex items-center justify-between gap-4">
          <Brand size="lg" />
          {lastGenre && (
            <Link href="/repertoire/" className="hidden items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink sm:inline-flex">
              Open the app
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          )}
        </header>

        <section className="mt-16 max-w-3xl sm:mt-24 lg:mt-28">
          <p className="label">A set list builder for working musicians</p>
          <h1 className="mt-5 font-serif text-[52px] leading-[0.95] tracking-[-0.015em] text-ink sm:text-[80px] xl:text-[92px]">
            Walk on with a set <br className="hidden sm:block" />
            <span className="text-ink-2 italic">that flows.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            Mark the songs you can call, tell it about the gig, and get a running order ready for the stand.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            {lastGenre ? (
              <Button variant="primary" size="lg" onClick={() => open(lastGenre)}>
                Continue with {GENRES[lastGenre].name}
                <ArrowRight strokeWidth={2} />
              </Button>
            ) : (
              <a href="#books" className={cx(buttonBase, buttonSizes.lg, buttonVariants.primary)}>
                Pick your book
                <ArrowRight strokeWidth={2} />
              </a>
            )}
            <span className="inline-flex items-center gap-2 text-[13px] text-muted">
              <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
              No account. Everything stays in this browser.
            </span>
          </div>
        </section>

        <section id="books" aria-labelledby="books-title" className="mt-20 scroll-mt-8 sm:mt-28">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line pb-4">
            <h2 id="books-title" className="font-serif text-[32px] leading-none text-ink">
              {lastGenre ? "Or open another book" : "Pick your book"}
            </h2>
            <span className="tabular font-mono text-xs text-muted">
              {GENRE_ORDER.length} books · {TOTAL.toLocaleString()} songs
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {GENRE_ORDER.map((k) => {
              const g = GENRES[k];
              const isLast = k === lastGenre;
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => open(k)}
                    className={cx(
                      "group flex h-full w-full items-start gap-4 rounded-2xl border bg-surface/80 p-4 text-left backdrop-blur-sm transition-colors duration-150 sm:p-5",
                      isLast ? "border-[rgb(255_43_69/0.55)]" : "border-line hover:border-line-strong hover:bg-surface-2/80",
                    )}
                  >
                    <Monogram k={k} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-serif text-[24px] leading-tight text-ink">{g.name}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 translate-y-[-1px] text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={1.75} />
                      </span>
                      <span className="tabular mt-0.5 block font-mono text-[11px] text-muted">
                        {GENRE_COUNTS[k].toLocaleString()} {g.noun}s{isLast && <span className="text-neon-hot"> · last opened</span>}
                      </span>
                      <span className="mt-2 line-clamp-2 block text-[13px] leading-snug text-muted">{g.tagline}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-16 text-xs text-faint">
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
