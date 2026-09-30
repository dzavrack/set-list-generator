"use client";
import { useEffect, useMemo, useState } from "react";
import type { GenreConfig, Song, Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { useRepertoire } from "@/lib/state";
import { CircleCheck, Plus, RotateCcw, SkipForward, Star, Undo2 } from "lucide-react";
import { StatusPicker, StyleTag } from "@/components/ui/Status";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Card, CardHeader } from "@/components/ui/Page";

/** One song at a time, most popular first. Keys 1–4 set status, S skips, U undoes. `onAdd` opens "add your own". */
export function QuickSort({ songs, genre, onOpen, onAdd }: { songs: Song[]; genre: GenreConfig; onOpen: (s: Song) => void; onAdd: () => void }) {
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
      <Card className="overflow-hidden">
        {/* header bar: what this is, how far along, and which style to work through */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3 sm:px-6">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="card-title text-[15px] font-semibold text-ink">Sort your {genre.noun}s</h2>
            <span className="tabular hidden font-mono text-xs text-muted sm:inline">{done.toLocaleString()} of {pool.length.toLocaleString()}</span>
          </div>
          <Select aria-label="Style to sort" value={style} onChange={(e) => setStyle(e.target.value)} className="h-9 w-[132px] text-[13px] sm:w-auto sm:min-w-[150px]">
            <option value="all">All styles</option>
            {Object.entries(genre.styles).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </Select>
        </div>
        <div className="h-1 bg-surface-3" aria-hidden>
          <div className="tube-h h-full !rounded-none transition-[width] duration-300" style={{ width: `${pool.length ? (done / pool.length) * 100 : 0}%` }} />
        </div>

        <div className="px-5 pt-6 pb-5 sm:px-7 sm:pt-7">
        {cur ? (
          <div className="flex flex-col gap-6">
            <div>
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[14px] text-ink-2">Do you know this one?</span>
                <span className="label flex items-center gap-2">
                {cur.rank ? `No. ${cur.rank}` : `Your ${genre.noun}`}
                {cur.hit && <span className="inline-flex items-center gap-1 text-neon-hot"><Star className="h-3 w-3 fill-current" />Crowd favourite</span>}
                </span>
              </p>
              <button type="button" onClick={() => onOpen(cur)} className="qs-title mt-2 text-left font-serif text-4xl leading-[0.98] text-ink hover:text-white sm:text-[52px]">
                {cur.title}
              </button>
              {(cur.artist || cur.year) && <p className="mt-2 text-[14px] text-ink-2">{[cur.artist, cur.year].filter(Boolean).join(" · ")}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">{cur.styles.map((c) => <StyleTag key={c}>{genre.styles[c] ?? c}</StyleTag>)}</div>
            </div>
            <StatusPicker size="lg" value={null} onChange={mark} />
            <div className="-mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
              <Button variant="ghost" size="sm" onClick={skip}><SkipForward strokeWidth={1.75} />Ask me later <kbd className="font-mono text-[10px] text-faint">S</kbd></Button>
              <Button variant="ghost" size="sm" onClick={undo} disabled={!history.length}><Undo2 strokeWidth={1.75} />Undo <kbd className="font-mono text-[10px] text-faint">U</kbd></Button>
              <Button size="sm" onClick={onAdd} className="ml-auto"><Plus strokeWidth={2} />Add your own {genre.noun}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 py-4">
            <CircleCheck className="h-8 w-8 text-neon-hot [filter:drop-shadow(0_0_8px_var(--neon))]" strokeWidth={1.5} />
            <p className="font-serif text-5xl text-ink">All sorted</p>
            <p className="text-ink-2">Every {style === "all" ? "" : genre.styles[style] + " "}{genre.noun} has a status{skipped.size ? `, apart from ${skipped.size} you set aside` : ""}.</p>
            <div className="flex flex-wrap gap-2">
              {skipped.size > 0 && <Button size="sm" onClick={() => setSkipped(new Set())}><RotateCcw strokeWidth={1.75} />Go back to those</Button>}
              <Button size="sm" onClick={onAdd}><Plus strokeWidth={2} />Add your own {genre.noun}</Button>
            </div>
          </div>
        )}
        </div>
      </Card>

      <Card className="self-start">
        <CardHeader title="Up next" description={`${queue.length.toLocaleString()} left to sort`} />
        <ol className="px-6 py-4">
          {queue.slice(1, 10).map((s, i) => (
            <li key={s.id} className="flex items-baseline gap-3 py-1.5">
              <span className="tabular w-4 text-right font-mono text-[11px] text-faint">{i + 1}</span>
              <span className="truncate font-serif title-plain text-[17px] text-ink-2">{s.title}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
