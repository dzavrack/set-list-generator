"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ListMusic, Metronome, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Page";
import { Empty } from "@/components/ui/Empty";
import { Input } from "@/components/ui/Field";
import { StyleTag, statusDot } from "@/components/ui/Status";
import { cx } from "@/components/ui/cx";
import { searchSongs } from "@/lib/catalog";
import type { QueueItem } from "@/lib/practice";
import type { Song } from "@/lib/types";
import { shortDate } from "./PlanPanel";

export interface UpNextItem extends QueueItem {
  title: string;
  sub?: string;
}

const SHOW = 8;

export function UpNext({
  items,
  selectedId,
  onSelect,
  onQuickPlan,
  loading,
  noun,
  songs,
  onAdd,
  learned,
}: {
  items: UpNextItem[];
  /** undefined: nothing picked; null: general practice */
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  onQuickPlan: (id: string) => void;
  loading: boolean;
  noun: "tune" | "song";
  songs: Song[];
  onAdd: (song: Song) => void;
  learned: { songId: string; title: string; doneDate?: string; minutes: number }[];
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOW);
  const general = selectedId === null;

  return (
    <Card role="region" aria-labelledby="upnext-h" className="overflow-hidden">
      <div className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <h2 id="upnext-h" className="text-[17px] font-medium text-ink">
          Up next
        </h2>
        {items.length > 0 && <span className="tabular font-mono text-xs text-muted">{items.length} in the queue</span>}
      </div>

      {loading && items.length === 0 ? (
        <div aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[68px] animate-pulse border-b border-line bg-surface-2/40 last:border-0" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-4">
          <Empty icon={ListMusic} title="Nothing on the stand">
            Mark {noun}s as Want to learn or Shaky in{" "}
            <Link href="/repertoire/" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-neon-hot">
              Repertoire
            </Link>{" "}
            to fill the queue, or search for one below.
          </Empty>
        </div>
      ) : (
        <ol>
          {shown.map((it, idx) => {
            const on = it.songId === selectedId;
            return (
              <li key={it.songId} className={cx("group relative flex items-center border-b border-line transition-colors", on ? "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--ink)_2%,transparent)]")}>
                {on && <span aria-hidden className="tube-v absolute top-2.5 bottom-2.5 left-0 !w-[3px]" />}
                <button type="button" aria-pressed={on} onClick={() => onSelect(it.songId)} className="flex min-w-0 flex-1 items-start gap-3.5 py-3.5 pr-2 pl-5 text-left sm:pl-6">
                  <span aria-hidden className={cx("mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full", it.status ? statusDot[it.status] : "bg-faint")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cx("min-w-0 truncate font-serif title-plain text-[21px] leading-tight", on ? "text-white" : "text-ink")}>{it.title}</span>
                      {idx === 0 && <StyleTag active>Next</StyleTag>}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">{it.reason}</span>
                    {it.info && (
                      <span className="mt-2 flex items-center gap-2.5" aria-hidden>
                        <span className="h-[2px] flex-1 overflow-hidden rounded-full bg-surface-3">
                          {it.info.progress > 0 && (
                            <span className={cx("block h-full rounded-full", on ? "tube-h" : "bg-ink-2/50")} style={{ width: `${it.info.progress * 100}%` }} />
                          )}
                        </span>
                        <span className="tabular font-mono text-[11px] text-faint">
                          {it.info.stepsDone}/{it.info.plan.steps.length}
                        </span>
                      </span>
                    )}
                  </span>
                </button>
                {!it.info && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onQuickPlan(it.songId)}
                    aria-label={`Start a plan for ${it.title}`}
                    className="mr-3 shrink-0 sm:mr-4"
                  >
                    <Plus strokeWidth={1.75} />
                    Plan
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {items.length > SHOW && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="flex h-11 w-full items-center justify-center gap-1.5 border-b border-line text-[13px] text-muted transition-colors hover:text-ink"
        >
          {all ? "Show fewer" : `Show all ${items.length}`}
          <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", all && "rotate-180")} strokeWidth={1.75} />
        </button>
      )}

      <div className={cx("relative border-b border-line transition-colors", general ? "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--ink)_2%,transparent)]")}>
        {general && <span aria-hidden className="tube-v absolute top-2.5 bottom-2.5 left-0 !w-[3px]" />}
        <button type="button" aria-pressed={general} onClick={() => onSelect(null)} className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left sm:px-6">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2">
            <Metronome className={cx("h-4 w-4", general ? "text-neon-hot" : "text-muted")} strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] text-ink">General practice</span>
            <span className="block text-[13px] text-muted">Scales, technique, reading</span>
          </span>
        </button>
      </div>

      <AddSong songs={songs} noun={noun} onAdd={onAdd} />

      {learned.length > 0 && (
        <details className="group border-t border-line">
          <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-5 text-[13px] text-muted select-none hover:text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
            <span>
              Learned with a plan <span className="tabular font-mono text-xs text-faint">{learned.length}</span>
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={1.75} />
          </summary>
          <ul className="px-5 pb-4 sm:px-6">
            {learned.map((l) => (
              <li key={l.songId} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="truncate font-serif title-plain text-[17px] text-ink-2">{l.title}</span>
                {l.doneDate && <span className="tabular shrink-0 font-mono text-[11px] text-faint">{shortDate(l.doneDate)}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function AddSong({ songs, noun, onAdd }: { songs: Song[]; noun: string; onAdd: (s: Song) => void }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => searchSongs(songs, q, 6), [songs, q]);
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Add a ${noun} to learn…`}
          aria-label={`Add a ${noun} to learn`}
          autoComplete="off"
          className="pl-10"
        />
      </div>
      {results.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-control border border-line-strong bg-surface-2" aria-label="Search results">
          {results.map((s) => (
            <li key={s.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => {
                  onAdd(s);
                  setQ("");
                }}
                className="group flex min-h-11 w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-surface-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif title-plain text-[17px] leading-tight text-ink">{s.title}</span>
                  {(s.artist || s.year) && <span className="block truncate text-xs text-muted">{[s.artist, s.year].filter(Boolean).join(" · ")}</span>}
                </span>
                <Plus className="h-4 w-4 shrink-0 text-muted group-hover:text-neon-hot" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length > 1 && results.length === 0 && <p className="mt-2 text-xs text-faint">No match in this book.</p>}
    </div>
  );
}
