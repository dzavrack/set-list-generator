import { Calendar, Clock, Info, ListMusic, MapPin, type LucideIcon } from "lucide-react";
import type { Repertoire, SetList, Song, Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { setMinutes } from "@/lib/engine";
import { searchSongs } from "@/lib/catalog";
import { Card } from "@/components/ui/Page";
import { statusDot } from "@/components/ui/Status";
import { cx } from "@/components/ui/cx";

export function fmtMin(m: number) {
  const r = Math.round(m);
  const h = Math.floor(r / 60);
  return h ? `${h}h ${String(r % 60).padStart(2, "0")}m` : `${r} min`;
}

export function prettyDate(iso?: string, withYear = true) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return isNaN(+d) ? iso : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

export const listTotal = (sl: SetList) => sl.sets.reduce((a, s) => a + setMinutes(s), 0);
export const listCount = (sl: SetList) => sl.sets.reduce((a, s) => a + s.items.length, 0);

/** The big serif, click-to-edit set list name. */
export function SetListName({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <textarea
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, " "))}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      aria-label="Set list name"
      spellCheck={false}
      className={cx(
        "block resize-none overflow-hidden [field-sizing:content] -mx-2.5 w-[calc(100%+1.25rem)] rounded-xl border border-transparent bg-transparent px-2.5 py-0.5 font-serif text-[36px] leading-[1.1] tracking-[-0.01em] text-ink transition-[border-color,box-shadow,background-color] duration-150 hover:border-line focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] focus:bg-surface/60 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_15%,transparent)] focus:outline-none sm:text-[44px]",
        className,
      )}
    />
  );
}

function Meta({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
      {children}
    </span>
  );
}

/** Date · venue · length · count, with icons. */
export function SetListMeta({ setList, noun, showPlace = true }: { setList: SetList; noun: string; showPlace?: boolean }) {
  const n = listCount(setList);
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-ink-2">
      {showPlace && setList.date && <Meta icon={Calendar}>{prettyDate(setList.date)}</Meta>}
      {showPlace && setList.venue && <Meta icon={MapPin}>{setList.venue}</Meta>}
      <Meta icon={Clock}><span className="tabular font-mono text-[12.5px]">{fmtMin(listTotal(setList))}</span></Meta>
      <Meta icon={ListMusic}>
        <span><span className="tabular font-mono text-[12.5px]">{n}</span> {noun}{n === 1 ? "" : "s"} in {setList.sets.length} set{setList.sets.length === 1 ? "" : "s"}</span>
      </Meta>
    </p>
  );
}

/** What the builder had to say about the night. */
export function BuilderNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <Card className="flex gap-3 px-5 py-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="label mb-1.5">Builder notes</p>
        <ul className="flex flex-col gap-1 text-sm leading-relaxed text-ink-2">
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </div>
    </Card>
  );
}

const STATUS_ORDER: Record<Status, number> = { know: 0, shaky: 1, learn: 2, no: 4 };

/** Search, then float the songs you know to the top (stable within each status). */
export function searchByStatus(songs: Song[], q: string, rep: Repertoire, limit = 6): Song[] {
  if (q.trim().length < 2) return [];
  const hits = searchSongs(songs, q, limit * 4);
  const rank = (s: Song) => { const st = rep[s.id]?.status; return st ? STATUS_ORDER[st] : 3; };
  return hits
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.s);
}

/** A search result row: serif title, artist, and the player's status for it. */
export function SongOption({ song, status, onPick, active }: { song: Song; status?: Status | null; onPick: () => void; active?: boolean }) {
  const st = status ? STATUSES.find((x) => x.value === status) : null;
  return (
    <button
      type="button"
      onClick={onPick}
      className={cx("flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors hover:bg-surface-3", active && "bg-surface-3/70")}
    >
      <span className="min-w-0">
        <span className="block truncate font-serif title-plain text-[17px] leading-snug text-ink">{song.title}</span>
        {song.artist && <span className="block truncate text-xs text-muted">{song.artist}</span>}
      </span>
      <span className={cx("flex shrink-0 items-center gap-1.5 text-xs", st ? "text-ink-2" : "text-faint")}>
        <span className={cx("h-1.5 w-1.5 rounded-full", status ? statusDot[status] : "border border-line-strong")} />
        {st ? st.short : "Unsorted"}
      </span>
    </button>
  );
}
