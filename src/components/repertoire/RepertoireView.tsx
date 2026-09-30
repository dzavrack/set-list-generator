"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { FileUp, Plus, Search, Star, X, BookOpenText } from "lucide-react";
import type { Song, Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { GENRES } from "@/lib/genres";
import { searchSongs, useSongs } from "@/lib/catalog";
import { useBooks, useCustomSongs, useGenre, useRepertoire } from "@/lib/state";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { PageHeader, StatCard, Tabs } from "@/components/ui/Page";
import { StatusBar, StatusPicker, StyleTag, statusDot } from "@/components/ui/Status";
import { Empty } from "@/components/ui/Empty";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/Toast";
import { SongSheet } from "./SongSheet";
import { QuickSort } from "./QuickSort";
import { AddSongSheet } from "./AddSongSheet";
import { ImportSheet } from "./ImportSheet";

type Filter = "all" | Status | "unsorted";
const PAGE = 120;
const sortTitle = (t: string) => t.replace(/^(the|a|an) |^['"(]+/i, "");

export function RepertoireView() {
  const [genreKey] = useGenre();
  // Filters belong to a book: switching books starts fresh.
  return <Repertoire key={genreKey} />;
}

function Repertoire() {
  const [genreKey] = useGenre();
  const genre = GENRES[genreKey];
  const [custom] = useCustomSongs();
  const { songs, loading } = useSongs(genreKey, custom);
  const { rep, setStatus, setStatusMany } = useRepertoire();
  const [books] = useBooks();

  // Quick sort is the default: the fastest way to get a book ready. Picking a stat tile switches to Browse.
  const [mode, setMode] = useState<"browse" | "sort">("sort");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [style, setStyle] = useState("all");
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState("popular");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Song | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);
  const [importing, setImporting] = useState(false);
  const [bulk, setBulk] = useState<Status | "clear" | null>(null);

  const counts = useMemo(() => {
    const c = { know: 0, shaky: 0, learn: 0, no: 0 } as Record<Status, number>;
    for (const s of songs) {
      const st = rep[s.id]?.status;
      if (st) c[st]++;
    }
    const sorted = c.know + c.shaky + c.learn + c.no;
    return { c, sorted, unsorted: songs.length - sorted, total: songs.length };
  }, [songs, rep]);

  const decades = useMemo(() => {
    if (genreKey === "jazz") return [];
    const set = new Set<number>();
    songs.forEach((s) => s.year && set.add(Math.floor(s.year / 10) * 10));
    return [...set].sort();
  }, [songs, genreKey]);
  const myBooks = useMemo(() => books.filter((b) => b.genre === genreKey), [books, genreKey]);

  const list = useMemo(() => {
    const searching = dq.trim().length > 1;
    const arr = (searching ? searchSongs(songs, dq, 600) : songs).filter((s) => {
      const st = rep[s.id]?.status ?? null;
      if (filter === "unsorted" ? st : filter !== "all" && st !== filter) return false;
      const styles = rep[s.id]?.styles ?? s.styles;
      if (style !== "all" && !styles.includes(style)) return false;
      if (scope === "top100") return s.rank != null && s.rank <= 100;
      if (scope === "top300") return s.rank != null && s.rank <= 300;
      if (scope === "hits") return !!s.hit;
      if (scope === "custom") return !!s.custom;
      if (scope.startsWith("decade:")) return !!s.year && Math.floor(s.year / 10) * 10 === Number(scope.slice(7));
      if (scope.startsWith("book:")) return !!myBooks.find((b) => b.id === scope.slice(5))?.ids.includes(s.id);
      return true;
    });
    if (searching && sort === "popular") return arr;
    if (scope.startsWith("book:") && sort === "popular") {
      const order = myBooks.find((b) => b.id === scope.slice(5))?.ids ?? [];
      return arr.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    const by = arr.slice();
    if (sort === "popular") by.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
    if (sort === "az") by.sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)));
    if (sort === "old") by.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    if (sort === "new") by.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    if (sort === "artist") by.sort((a, b) => (a.artist ?? "").replace(/^The /, "").localeCompare((b.artist ?? "").replace(/^The /, "")));
    return by;
  }, [songs, dq, rep, filter, style, scope, sort, myBooks]);

  const hasHits = useMemo(() => songs.some((s) => s.hit), [songs]);
  const ownCount = useMemo(() => songs.filter((s) => s.custom).length, [songs]);
  const filtersActive = filter !== "all" || style !== "all" || scope !== "all" || !!q;
  const clearFilters = () => { setFilter("all"); setStyle("all"); setScope("all"); setQ(""); setShown(PAGE); };
  const pickFilter = (f: Filter) => { setFilter(filter === f ? "all" : f); setMode("browse"); setShown(PAGE); };
  const pct = (n: number) => (counts.total ? `${Math.round((n / counts.total) * 100)}% of the book` : "");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={genre.name}
        description={`Mark what you can call on the bandstand. The builder only reaches for ${genre.noun}s you know.`}
        actions={
          <>
            <Button onClick={() => setImporting(true)}><FileUp strokeWidth={1.75} />Import a list</Button>
          </>
        }
      />

      <Tabs
        label="View"
        value={mode}
        onChange={setMode}
        tabs={[{ value: "sort", label: "Quick sort" }, { value: "browse", label: "Browse" }]}
        right={<span className="tabular hidden font-mono text-xs text-muted sm:inline">{loading ? "Loading…" : `${(counts.total - ownCount).toLocaleString()} ${genre.noun}s in ${genre.name}${ownCount ? ` + ${ownCount} of yours` : ""}`}</span>}
      />

      <section aria-label="Your repertoire at a glance" className="stats-compact grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        <StatCard label="Know it" dot={statusDot.know} tone="know" value={counts.c.know} sub={pct(counts.c.know)} active={filter === "know"} onClick={() => pickFilter("know")} />
        <StatCard label="Shaky" dot={statusDot.shaky} tone="shaky" value={counts.c.shaky} sub="Needs a chart" active={filter === "shaky"} onClick={() => pickFilter("shaky")} />
        <StatCard label="Want to learn" dot={statusDot.learn} tone="learn" value={counts.c.learn} sub="In the practice queue" active={filter === "learn"} onClick={() => pickFilter("learn")} />
        <StatCard label="Unsorted" value={counts.unsorted.toLocaleString()} sub={counts.c.no ? `${counts.c.no} skipped` : "Quick sort gets through them fast"} active={filter === "unsorted"} onClick={() => pickFilter("unsorted")} />
        <StatusBar counts={counts.c} total={counts.total} className="col-span-full -mt-0.5" />
      </section>

      {mode === "sort" ? (
        <QuickSort songs={songs} genre={genre} onOpen={setOpen} onAdd={() => { setEditing(null); setAdding(true); }} />
      ) : (
        <section aria-label={`${genre.noun}s`} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-[1_1_320px]">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
              <Input type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder={`Search ${genre.noun}s${genreKey === "jazz" ? "" : " or artists"}…`} aria-label="Search" className="pl-10" />
            </div>
            <Select aria-label="Status" value={filter} onChange={(e) => pickFilter(e.target.value as Filter)} className="w-auto min-w-[150px] flex-1 sm:flex-none">
              <option value="all">Any status</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              <option value="unsorted">Unsorted</option>
            </Select>
            <Select aria-label="Which songs" value={scope} onChange={(e) => { setScope(e.target.value); setShown(PAGE); }} className="w-auto min-w-[150px] flex-1 sm:flex-none">
              <option value="all">Whole book</option>
              <option value="top100">Top 100</option>
              <option value="top300">Top 300</option>
              {hasHits && <option value="hits">Crowd favourites</option>}
              <option value="custom">My own {genre.noun}s</option>
              {decades.length > 0 && <optgroup label="Decade">{decades.map((d) => <option key={d} value={`decade:${d}`}>{d}s</option>)}</optgroup>}
              {myBooks.length > 0 && <optgroup label="My lists">{myBooks.map((b) => <option key={b.id} value={`book:${b.id}`}>{b.name}</option>)}</optgroup>}
            </Select>
            <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto min-w-[150px] flex-1 sm:flex-none">
              <option value="popular">Most played</option>
              <option value="az">A–Z</option>
              {genreKey !== "jazz" && <option value="old">Oldest first</option>}
              {genreKey !== "jazz" && <option value="new">Newest first</option>}
              {genreKey !== "jazz" && <option value="artist">By artist</option>}
            </Select>
          </div>

          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Style">
            {[["all", "All styles"] as const, ...Object.entries(genre.styles)].map(([code, label]) => {
              const on = style === code;
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setStyle(code); setShown(PAGE); }}
                  className={cx(
                    "h-8 shrink-0 rounded-chip border px-3.5 text-[13px] transition-colors",
                    on ? "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-ink shadow-[0_0_16px_-6px_var(--neon-glow)]" : "border-line-strong text-ink-2 hover:border-[color-mix(in_srgb,var(--ink)_22%,transparent)] hover:text-ink",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
            <span className="flex items-center gap-3">
              <span className="tabular">{list.length.toLocaleString()} {genre.noun}{list.length === 1 ? "" : "s"}</span>
              {filtersActive && (
                <button type="button" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              )}
            </span>
            {list.length > 0 && list.length <= 400 && filtersActive &&
              (bulk ? (
                <span className="flex items-center gap-2">
                  <span className="text-ink-2">{bulk === "clear" ? `Clear the status on all ${list.length}?` : `Mark all ${list.length} as ${STATUSES.find((s) => s.value === bulk)!.label}?`}</span>
                  <Button size="sm" variant="primary" onClick={() => { setStatusMany(list.map((s) => s.id), bulk === "clear" ? null : bulk); toast(`Updated ${list.length} ${genre.noun}s`); setBulk(null); }}>Yes, update</Button>
                  <Button size="sm" variant="ghost" onClick={() => setBulk(null)}>Cancel</Button>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="mr-1">Mark all shown</span>
                  {STATUSES.map((s) => <Button key={s.value} size="sm" variant="ghost" onClick={() => setBulk(s.value)}>{s.short}</Button>)}
                  <Button size="sm" variant="ghost" onClick={() => setBulk("clear")}>Clear</Button>
                </span>
              ))}
          </div>

          {loading ? (
            <div className="overflow-hidden rounded-2xl border border-line">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-[76px] animate-pulse border-b border-line bg-surface/60 last:border-0" />)}
            </div>
          ) : list.length === 0 ? (
            <Empty icon={BookOpenText} title="Nothing matches" action={<Button onClick={() => { setEditing(null); setAdding(true); }}><Plus />Add {q ? `“${q}”` : `a ${genre.noun}`} as your own</Button>}>
              No {genre.noun}s fit those filters. Clear them, or add the {genre.noun} yourself.
            </Empty>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-line bg-surface/50">
              {list.slice(0, shown).map((s) => {
                const e = rep[s.id];
                const styles = e?.styles ?? s.styles;
                const meta = [s.artist, s.year].filter(Boolean).join(" · ");
                return (
                  <li key={s.id} data-tone={e?.status} className="song-row group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-0 hover:bg-[color-mix(in_srgb,var(--ink)_2%,transparent)] sm:gap-5 sm:px-6">
                    <span className="tabular hidden w-8 shrink-0 text-right font-mono text-xs text-faint sm:block">{s.rank ?? "·"}</span>
                    <button type="button" onClick={() => setOpen(s)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-serif title-plain text-[21px] leading-tight text-ink group-hover:text-white">{s.title}</span>
                        {s.hit && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-neon-hot" aria-label="Crowd favourite" />}
                        {e?.key && <span className="shrink-0 rounded-md border border-line-strong px-1.5 py-px font-mono text-[11px] text-ink-2">{e.key}</span>}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {meta && <span className="mr-1 truncate text-[13px] text-muted">{meta}</span>}
                        {s.custom && <StyleTag active>Yours</StyleTag>}
                        {styles.slice(0, 4).map((c) => <StyleTag key={c} active={c === style}>{genre.styles[c] ?? c}</StyleTag>)}
                      </span>
                    </button>
                    <StatusPicker value={e?.status} onChange={(st) => setStatus(s.id, st)} className="shrink-0 max-sm:hidden" />
                    <MobileStatus value={e?.status ?? null} onChange={(st) => setStatus(s.id, st)} />
                  </li>
                );
              })}
            </ul>
          )}
          {list.length > shown && (
            <div className="flex justify-center pt-2">
              <Button onClick={() => setShown((n) => n + PAGE * 2)}>Show more · {(list.length - shown).toLocaleString()} left</Button>
            </div>
          )}
        </section>
      )}

      <SongSheet song={open ? songs.find((s) => s.id === open.id) ?? open : null} genre={genre} onClose={() => setOpen(null)} onEdit={(s) => { setOpen(null); setEditing(s); setAdding(true); }} />
      <AddSongSheet open={adding} onClose={() => setAdding(false)} genre={genre} songs={songs} editing={editing} />
      <ImportSheet open={importing} onClose={() => setImporting(false)} genre={genre} songs={songs} />
    </div>
  );
}

/** Phones: one tap cycles the status instead of four tiny buttons. */
function MobileStatus({ value, onChange }: { value: Status | null; onChange: (s: Status) => void }) {
  const order: Status[] = ["know", "shaky", "learn", "no"];
  const next = value ? order[(order.indexOf(value) + 1) % order.length] : "know";
  const label = value ? STATUSES.find((s) => s.value === value)!.short : "Sort";
  return (
    <button
      type="button"
      onClick={() => onChange(value === "no" ? "no" : next)}
      aria-label={`Status: ${label}. Tap to change`}
      className={cx("flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium sm:hidden", value ? "border-line-strong text-ink" : "border-dashed border-line-strong text-muted")}
    >
      {value && <span className={cx("h-1.5 w-1.5 rounded-full", statusDot[value])} />}
      {label}
    </button>
  );
}
