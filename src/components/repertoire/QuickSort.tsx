"use client";
import { useEffect, useMemo, useState } from "react";
import type { GenreConfig, Song, Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { useRepertoire } from "@/lib/state";
import { CircleCheck, RotateCcw, SkipForward, Star, Undo2 } from "lucide-react";
import { StatusPicker, StyleTag } from "@/components/ui/Status";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Card, CardHeader } from "@/components/ui/Page";

/** One song at a time, most popular first. Keys 1–4 set status, S skips, U undoes. */
export function QuickSort({ songs, genre, onOpen }: { songs: Song[]; genre: GenreConfig; onOpen: (s: Song) => void }) {
  const { rep, setStatus } = useRepertoire();
  const [style, setStyle] = useState("all");
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<{ id: string; prev: Status | null; skip?: boolean }[]>([]);

  const queue = useMemo(
    () =>
      songs
        .filter((s) => !rep[s.id]?.status && !skipped.has(s.id) && (style === "all" || s.styles.includes(style)))
        .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9)),
    [songs, rep, skipped, style],
  );
  const pool = songs.filter((s) => style === "all" || s.styles.includes(style));
  const done = pool.filter((s) => rep[s.id]?.status).length;
  const cur = queue[0];

  const mark = (s: Status) => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-49), { id: cur.id, prev: rep[cur.id]?.status ?? null }]);
    setStatus(cur.id, s);
  };
  const skip = () => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-49), { id: cur.id, prev: null, skip: true }]);
    setSkipped((x) => new Set(x).add(cur.id));
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    if (last.skip) {
      setSkipped((x) => { const n = new Set(x); n.delete(last.id); return n; });
      return;
    }
    setStatus(last.id, rep[last.id]?.status ?? null); // clear the status we set
    if (last.prev) setStatus(last.id, last.prev);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input,textarea,select,dialog")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = STATUSES.find((s) => s.hotkey === e.key);
      if (st) mark(st.value);
      else if (e.key.toLowerCase() === "s") skip();
      else if (e.key.toLowerCase() === "u") undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="relative overflow-hidden p-6 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgb(255_43_69/0.14),transparent)] blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <span className="tabular font-mono text-xs text-muted">{done.toLocaleString()} of {pool.length.toLocaleString()} sorted</span>
          <Select aria-label="Style to sort" value={style} onChange={(e) => setStyle(e.target.value)} className="w-auto min-w-[170px]">
            <option value="all">All styles</option>
            {Object.entries(genre.styles).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </Select>
        </div>
        <div className="relative mt-4 h-[3px] overflow-hidden rounded-full bg-surface-3">
          <div className="tube-h h-full transition-[width] duration-300" style={{ width: `${pool.length ? (done / pool.length) * 100 : 0}%` }} />
        </div>

        {cur ? (
          <div className="relative mt-12 flex flex-col gap-8 sm:mt-16">
            <div>
              <p className="label flex items-center gap-2">
                {cur.rank ? `No. ${cur.rank}` : `Your ${genre.noun}`}
                {cur.hit && <span className="inline-flex items-center gap-1 text-neon-hot"><Star className="h-3 w-3 fill-current" />Crowd favourite</span>}
              </p>
              <button type="button" onClick={() => onOpen(cur)} className="mt-3 text-left font-serif text-5xl leading-[0.98] text-ink hover:text-white sm:text-7xl">
                {cur.title}
              </button>
              {(cur.artist || cur.year) && <p className="mt-3 text-ink-2">{[cur.artist, cur.year].filter(Boolean).join(" · ")}</p>}
              <div className="mt-4 flex flex-wrap gap-1.5">{cur.styles.map((c) => <StyleTag key={c}>{genre.styles[c] ?? c}</StyleTag>)}</div>
            </div>
            <StatusPicker size="lg" value={null} onChange={mark} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button variant="ghost" size="sm" onClick={skip}><SkipForward strokeWidth={1.75} />Ask me later <kbd className="font-mono text-[10px] text-faint">S</kbd></Button>
              <Button variant="ghost" size="sm" onClick={undo} disabled={!history.length}><Undo2 strokeWidth={1.75} />Undo <kbd className="font-mono text-[10px] text-faint">U</kbd></Button>
              <span className="ml-auto hidden text-xs text-faint sm:block">Keys 1–4 set the status</span>
            </div>
          </div>
        ) : (
          <div className="relative mt-16 flex flex-col items-start gap-3">
            <CircleCheck className="h-8 w-8 text-neon-hot [filter:drop-shadow(0_0_8px_var(--neon))]" strokeWidth={1.5} />
            <p className="font-serif text-5xl text-ink">All sorted</p>
            <p className="text-ink-2">Every {style === "all" ? "" : genre.styles[style] + " "}{genre.noun} has a status{skipped.size ? `, apart from ${skipped.size} you set aside` : ""}.</p>
            {skipped.size > 0 && <Button size="sm" onClick={() => setSkipped(new Set())}><RotateCcw strokeWidth={1.75} />Go back to those</Button>}
          </div>
        )}
      </Card>

      <Card className="self-start">
        <CardHeader title="Up next" description={`${queue.length.toLocaleString()} left to sort`} />
        <ol className="px-6 py-4">
          {queue.slice(1, 10).map((s, i) => (
            <li key={s.id} className="flex items-baseline gap-3 py-1.5">
              <span className="tabular w-4 text-right font-mono text-[11px] text-faint">{i + 1}</span>
              <span className="truncate font-serif text-[17px] text-ink-2">{s.title}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
