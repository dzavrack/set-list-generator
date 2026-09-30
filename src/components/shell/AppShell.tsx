"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSongs } from "@/lib/catalog";
import { GENRES } from "@/lib/genres";
import { KEYS, useCustomSongs, useGenre, useRepertoire } from "@/lib/state";
import { readKey, writeKey } from "@/lib/storage";
import { Toaster } from "@/components/ui/Toast";
import { cx } from "@/components/ui/cx";
import { NoirBackdrop } from "./NoirBackdrop";
import { Brand, BrandMark } from "./Brand";
import { BookSwitcher } from "./BookSwitcher";
import { MOBILE_MORE, MOBILE_NAV, MoreIcon, NAV_SECTIONS, isActive } from "./nav";

/** First visit: seed the owner's existing jazz statuses from the old app. */
function useSeed() {
  useEffect(() => {
    if (readKey(KEYS.seeded, false)) return;
    import("@/data/seed-jazz.json").then((m) => {
      const existing = readKey<Record<string, unknown>>(KEYS.rep, {});
      writeKey(KEYS.rep, { ...(m.default as object), ...existing });
      writeKey(KEYS.seeded, true);
    });
  }, []);
}

function SortedMeter() {
  const [genre] = useGenre();
  const [custom] = useCustomSongs();
  const { songs } = useSongs(genre, custom);
  const { rep } = useRepertoire();
  const { sorted, know } = useMemo(() => {
    let sorted = 0, know = 0;
    for (const s of songs) {
      const st = rep[s.id]?.status;
      if (st) sorted++;
      if (st === "know") know++;
    }
    return { sorted, know };
  }, [songs, rep]);
  const pct = songs.length ? (sorted / songs.length) * 100 : 0;
  return (
    <Link href="/repertoire/" className="block rounded-xl border border-line bg-surface/60 p-3.5 backdrop-blur-sm transition-colors hover:border-line-strong">
      <div className="flex items-baseline justify-between">
        <span className="label">Sorted</span>
        <span className="tabular font-mono text-xs text-ink-2">{sorted.toLocaleString()} / {songs.length.toLocaleString()}</span>
      </div>
      <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-surface-3">
        <div className="tube-h h-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2.5 text-xs text-muted">
        <span className="text-ink">{know}</span> {GENRES[genre].noun}s ready for the stand
      </p>
    </Link>
  );
}

function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col px-4 pt-6 pb-4 lg:flex">
      <Link href="/" className="mb-6 px-2" aria-label="The Gig Book, home">
        <Brand />
      </Link>
      <BookSwitcher />
      <nav aria-label="Main" className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto">
        {NAV_SECTIONS.map((sec, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {sec.title && <p className="label mb-1.5 px-3">{sec.title}</p>}
            {sec.items.map((n) => {
              const on = isActive(path, n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors",
                    on ? "bg-[rgb(255_236_228/0.07)] text-ink" : "text-ink-2 hover:bg-[rgb(255_236_228/0.04)] hover:text-ink",
                  )}
                >
                  {on && <span className="tube-v absolute top-2 bottom-2 -left-4 !w-[3px]" />}
                  <Icon className={cx("h-[18px] w-[18px] shrink-0", on ? "text-neon-hot [filter:drop-shadow(0_0_6px_var(--neon))]" : "text-muted group-hover:text-ink-2")} strokeWidth={1.75} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <SortedMeter />
    </aside>
  );
}

function MobileTop() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 py-2.5 backdrop-blur-xl lg:hidden">
      <Link href="/" aria-label="The Gig Book, home" className="flex items-center gap-2">
        <BrandMark className="h-6 w-6" />
        <span className="neon font-neon text-lg leading-none">Gig Book</span>
      </Link>
      <div className="w-44"><BookSwitcher compact /></div>
    </header>
  );
}

function MobileTabs() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const moreOn = MOBILE_MORE.some((n) => isActive(path, n.href));
  return (
    <>
    {more && (
      <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMore(false)}>
        <div className="absolute right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] w-52 rounded-xl border border-line-strong bg-surface-2/95 p-1.5 shadow-[0_20px_50px_rgb(0_0_0/0.7)] backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
          {MOBILE_MORE.map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} onClick={() => setMore(false)} className={cx("flex h-11 items-center gap-3 rounded-lg px-3 text-sm", isActive(path, n.href) ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-3")}>
                <Icon className="h-[18px] w-[18px] text-muted" strokeWidth={1.75} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </div>
    )}
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {MOBILE_NAV.map((n) => {
          const on = isActive(path, n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cx("relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10.5px] font-medium", on ? "text-ink" : "text-muted")}>
              {on && <span className="tube-h absolute top-0 left-1/2 w-8 -translate-x-1/2" />}
              <Icon className={cx("h-5 w-5", on && "text-neon-hot [filter:drop-shadow(0_0_6px_var(--neon))]")} strokeWidth={1.75} />
              {n.label}
            </Link>
          );
        })}
        <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className={cx("relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10.5px] font-medium", moreOn || more ? "text-ink" : "text-muted")}>
          {moreOn && <span className="tube-h absolute top-0 left-1/2 w-8 -translate-x-1/2" />}
          <MoreIcon className={cx("h-5 w-5", moreOn && "text-neon-hot")} strokeWidth={1.75} />
          More
        </button>
      </div>
    </nav>
    </>
  );
}

function QuickAction() {
  const path = usePathname();
  if (isActive(path, "/build/") || isActive(path, "/sets/") || path === "/") return null;
  return (
    <Link
      href="/build/"
      className="fixed right-5 bottom-5 z-30 hidden h-11 items-center gap-2 rounded-full border border-line-strong bg-surface-2/90 px-4 text-sm font-medium text-ink shadow-[0_12px_40px_rgb(0_0_0/0.6)] backdrop-blur-xl transition-colors hover:border-[rgb(255_43_69/0.6)] hover:shadow-[0_0_24px_-4px_var(--neon-glow)] lg:flex"
    >
      <Sparkles className="h-4 w-4 text-neon-hot" strokeWidth={1.75} />
      New set list
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useSeed();
  return (
    <div className="relative min-h-dvh">
      <NoirBackdrop />
      <Sidebar />
      <MobileTop />
      <div className="relative z-10 lg:py-3 lg:pr-3 lg:pl-[272px]">
        <main className="relative min-h-[calc(100dvh-1.5rem)] bg-panel/95 px-4 pt-6 pb-28 shadow-[0_30px_80px_rgb(0_0_0/0.6)] sm:px-8 lg:rounded-[22px] lg:border lg:border-line lg:px-12 lg:pt-12 lg:pb-16">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
      <MobileTabs />
      <QuickAction />
      <Toaster />
    </div>
  );
}
