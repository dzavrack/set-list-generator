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
import { StatusBar } from "@/components/ui/Status";
import type { Status } from "@/lib/types";
import { cx } from "@/components/ui/cx";
import { Backdrop } from "./Backdrop";
import { LookSwitch } from "./LookSwitch";
import { Brand } from "./Brand";
import { BookSwitcher } from "./BookSwitcher";
import { MOBILE_MORE, MOBILE_NAV, MoreIcon, NAV_SECTIONS, isActive } from "./nav";
import { GENRE_COUNTS } from "./BookSwitcher";

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
  const { sorted, know, counts } = useMemo(() => {
    const counts: Record<Status, number> = { know: 0, shaky: 0, learn: 0, no: 0 };
    let sorted = 0;
    for (const s of songs) {
      const st = rep[s.id]?.status;
      if (st) {
        sorted++;
        counts[st]++;
      }
    }
    return { sorted, know: counts.know, counts };
  }, [songs, rep]);
  const pct = songs.length ? (sorted / songs.length) * 100 : 0;
  return (
    <Link href="/repertoire/" className="block rounded-xl border border-line bg-surface/60 p-3.5 backdrop-blur-sm transition-colors hover:border-line-strong">
      <div className="flex items-baseline justify-between">
        <span className="label">Sorted</span>
        <span className="tabular font-mono text-xs text-ink-2">{sorted.toLocaleString()} / {songs.length.toLocaleString()}</span>
      </div>
      <StatusBar counts={counts} total={songs.length} className="not-noir mt-2.5 h-[3px]" />
      <div className="look-noir mt-2.5 h-[3px] overflow-hidden rounded-full bg-surface-3">
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
  const [genre] = useGenre();
  return (
    <aside className="not-sleeve fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col px-4 pt-6 pb-4 lg:flex">
      <Link href="/" className="mb-6 px-2" aria-label="The Gig Book, home">
        <Brand sign={GENRES[genre].sign} />
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
                  data-tone={n.tone}
                  className={cx(
                    "nav-link group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors",
                    on ? "bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] text-ink" : "text-ink-2 hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] hover:text-ink",
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
      <LookSwitch className="mt-3 px-1" />
    </aside>
  );
}

/** The two sides of the record: the everyday tracks, then the woodshed and the book's settings. */
const SIDES = [
  { side: "A", items: NAV_SECTIONS[0].items },
  { side: "B", items: NAV_SECTIONS.slice(1).flatMap((s) => s.items) },
];

/**
 * Sleeve look: the book as a record. A spine in the book's colour with the title running up it,
 * and the pages listed as a tracklist, Side A and Side B.
 */
function SleeveRail() {
  const path = usePathname();
  const [genre] = useGenre();
  const g = GENRES[genre];
  return (
    <aside className="look-sleeve sleeve-rail fixed inset-y-0 left-0 z-30 hidden w-[256px] lg:flex">
      <div className="sleeve-spine">
        <Link href="/" aria-label="The Gig Book, home" className="spine-mark">GB</Link>
        <span className="spine-title">{g.sign}<span className="spine-sep">·</span>The Gig Book</span>
        <span className="spine-cat">GB-{GENRE_COUNTS[genre]}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-6 pb-4">
        <p className="sleeve-kicker">The Gig Book presents</p>
        <p className="sleeve-rail-title">{g.sign}</p>
        <BookSwitcher />
        <nav aria-label="Main" className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto">
          {SIDES.map(({ side, items }) => (
            <div key={side}>
              <p className="sleeve-side">Side {side}</p>
              <ol className="mt-1.5 flex flex-col">
                {items.map((n, i) => {
                  const on = isActive(path, n.href);
                  const Icon = n.icon;
                  return (
                    <li key={n.href}>
                      <Link href={n.href} aria-current={on ? "page" : undefined} data-tone={n.tone} className="sleeve-track">
                        <span className="track-no">{side}{i + 1}</span>
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        <span className="truncate">{n.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </nav>
        <SortedMeter />
        <LookSwitch className="mt-3 px-1" />
      </div>
    </aside>
  );
}

function MobileTop() {
  const [genre] = useGenre();
  return (
    <header className="mobile-top sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 py-2.5 backdrop-blur-xl lg:hidden">
      <Link href="/" aria-label="The Gig Book, home" className="flex min-w-0 items-center gap-2">
        <Brand size="sm" sign={GENRES[genre].sign} />
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
        <div className="absolute right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] w-60 rounded-xl border border-line-strong bg-surface-2/95 p-1.5 shadow-[0_20px_50px_rgb(0_0_0/0.7)] backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
          {MOBILE_MORE.map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} onClick={() => setMore(false)} className={cx("flex h-11 items-center gap-3 rounded-lg px-3 text-sm", isActive(path, n.href) ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-3")}>
                <Icon className="h-[18px] w-[18px] text-muted" strokeWidth={1.75} />
                {n.label}
              </Link>
            );
          })}
          <LookSwitch className="mt-1 border-t border-line px-2 pt-2.5 pb-1" />
        </div>
      </div>
    )}
    <nav aria-label="Main" className="mobile-tabs fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {MOBILE_NAV.map((n) => {
          const on = isActive(path, n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} data-tone={n.tone} className={cx("mobile-tab relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10.5px] font-medium", on ? "text-ink" : "text-muted")}>
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
      className="quick-action fixed right-5 bottom-5 z-30 hidden h-11 items-center gap-2 rounded-chip border border-line-strong bg-surface-2/90 px-4 text-sm font-medium text-ink shadow-[0_12px_40px_rgb(0_0_0/0.6)] backdrop-blur-xl transition-colors hover:border-[color-mix(in_srgb,var(--accent)_60%,transparent)] hover:shadow-[0_0_24px_-4px_var(--neon-glow)] lg:flex"
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
      <Backdrop />
      <Sidebar />
      <SleeveRail />
      <MobileTop />
      <div className="relative z-10 lg:py-3 lg:pr-3 lg:pl-[272px]">
        <main className="app-panel relative min-h-[calc(100dvh-1.5rem)] bg-panel/95 px-4 pt-6 pb-28 shadow-[0_30px_80px_rgb(0_0_0/0.6)] sm:px-8 lg:rounded-panel lg:border lg:border-line lg:px-12 lg:pt-8 lg:pb-16">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
      <MobileTabs />
      <QuickAction />
      <Toaster />
    </div>
  );
}
