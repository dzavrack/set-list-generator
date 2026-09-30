"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Copy, ListMusic, MapPin, Plus, Search, Share, Trash2, X } from "lucide-react";
import type { SetList, Song } from "@/lib/types";
import { SETTINGS } from "@/lib/types";
import { GENRES } from "@/lib/genres";
import { useSongs } from "@/lib/catalog";
import { useCustomSongs, useGenre, useRepertoire, useSetLists } from "@/lib/state";
import { useRules } from "@/lib/rules";
import { uid } from "@/lib/storage";
import { Button, buttonBase, buttonSizes, buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { PageHeader, StatCard } from "@/components/ui/Page";
import { Empty } from "@/components/ui/Empty";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/Toast";
import { SetListEditor } from "@/components/setlist/SetListEditor";
import { BuilderNotes, SetListMeta, SetListName, fmtMin, listTotal, prettyDate } from "@/components/setlist/parts";
import { SongSheet } from "@/components/repertoire/SongSheet";
import { ExportDialog } from "@/components/export/ExportDialog";

const newListClass = cx(buttonBase, buttonSizes.md, buttonVariants.primary);

/** Local yyyy-mm-dd, so "upcoming" means today or later where the player is. */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SetsView() {
  const [genreKey] = useGenre();
  const genre = GENRES[genreKey];
  const [custom] = useCustomSongs();
  const { songs, byId } = useSongs(genreKey, custom);
  const { rep } = useRepertoire();
  const { rules } = useRules(genreKey);
  const [setlists, setSetlists] = useSetLists();
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [today] = useState(todayISO);

  const all = useMemo(() => setlists.filter((s) => s.genre === genreKey).sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt)), [setlists, genreKey]);
  const mine = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all;
    // Name, venue, date, and every song title in the sets and backups.
    const hay = (s: SetList) => [s.name, s.venue, s.date, prettyDate(s.date), ...s.sets.flatMap((x) => x.items.map((i) => i.title)), ...s.backups.map((i) => i.title)].join(" ").toLowerCase();
    return all.filter((s) => hay(s).includes(t));
  }, [all, q]);

  const stats = useMemo(() => {
    const upcoming = all.filter((s) => s.date && s.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
    const plays = new Map<string, { title: string; n: number }>();
    let slots = 0;
    for (const sl of all) {
      for (const set of sl.sets) {
        for (const it of set.items) {
          slots++;
          const p = plays.get(it.songId);
          if (p) p.n++;
          else plays.set(it.songId, { title: it.title, n: 1 });
        }
      }
    }
    let top: { title: string; n: number } | null = null;
    for (const p of plays.values()) if (!top || p.n > top.n) top = p;
    return { upcoming, unique: plays.size, slots, top };
  }, [all, today]);

  const open = setlists.find((s) => s.id === openId) ?? null;
  const update = (sl: SetList) => setSetlists(setlists.map((s) => (s.id === sl.id ? { ...sl, updatedAt: new Date().toISOString() } : s)));

  if (open) {
    return (
      <SetListDetail
        key={open.id}
        setList={open}
        onBack={() => setOpenId(null)}
        onChange={update}
        onDuplicate={() => {
          const now = new Date().toISOString();
          const copy = { ...open, id: uid("sl-"), name: `${open.name} (copy)`, createdAt: now, updatedAt: now };
          setSetlists([copy, ...setlists]);
          setOpenId(copy.id);
          toast("Duplicated");
        }}
        onDelete={() => {
          setSetlists(setlists.filter((s) => s.id !== open.id));
          setOpenId(null);
          toast(`Deleted “${open.name}”`);
        }}
        songs={songs}
        byId={byId}
        rep={rep}
        rules={rules}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PageHeader
        title="Set lists"
        description="Every night you've saved, ready to tweak, export or play again."
        actions={
          <>
            {all.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search lists or ${genre.noun}s`} aria-label="Search set lists" className="pl-10" />
              </div>
            )}
            <Link href="/build/" className={newListClass}>
              <Plus strokeWidth={2} />
              New set list
            </Link>
          </>
        }
      />

      {all.length > 0 && (
        <section aria-label="Set lists at a glance" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Saved lists" value={all.length} sub={`${genre.name} book`} />
          <StatCard
            label="Upcoming gigs"
            value={stats.upcoming.length}
            sub={stats.upcoming[0] ? `Next: ${prettyDate(stats.upcoming[0].date, false)}` : "Add a date to a list"}
          />
          <StatCard label={`${genre.noun[0].toUpperCase()}${genre.noun.slice(1)}s across lists`} value={stats.unique} sub={`${stats.slots} slots in all`} />
          <StatCard
            label="Most played"
            className="[&>span]:max-w-full"
            value={stats.top ? <span className="block truncate font-serif text-[24px] leading-[1.15] sm:text-[30px] font-normal tracking-normal">{stats.top.title}</span> : "—"}
            sub={stats.top ? `In ${stats.top.n} of ${all.length} list${all.length === 1 ? "" : "s"}` : undefined}
          />
        </section>
      )}

      {all.length === 0 ? (
        <Empty
          icon={ListMusic}
          title="Nothing on the stand yet"
          action={<Link href="/build/" className={cx(buttonBase, buttonSizes.md, buttonVariants.secondary)}><Plus strokeWidth={2} />Build a set</Link>}
        >
          Build a set, press Save, and it lands here, ready to export as text or a PDF.
        </Empty>
      ) : mine.length === 0 ? (
        <Empty icon={Search} title="No set lists match" action={<Button onClick={() => setQ("")}><X strokeWidth={1.75} />Clear search</Button>}>
          Nothing saved matches “{q}”. Try a venue, a month or a {genre.noun} title.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((sl) => <SetListCard key={sl.id} sl={sl} upcoming={!!sl.date && sl.date >= today} onOpen={() => setOpenId(sl.id)} />)}
        </ul>
      )}
    </div>
  );
}

function SetListCard({ sl, upcoming, onOpen }: { sl: SetList; upcoming: boolean; onOpen: () => void }) {
  const titles = sl.sets.flatMap((s) => s.items.map((i) => i.title));
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col rounded-2xl border border-line bg-surface/80 text-left transition-colors hover:border-line-strong hover:bg-surface-2/70"
      >
        <div className="flex flex-col gap-2 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className={cx("inline-flex items-center gap-1.5 font-mono text-xs", sl.date ? "text-ink-2" : "text-faint")}>
              <Calendar className="h-3.5 w-3.5 text-muted" strokeWidth={1.75} />
              {prettyDate(sl.date) || "No date"}
            </span>
            {upcoming && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-hot" />
                Upcoming
              </span>
            )}
          </div>
          <span className="line-clamp-2 font-serif text-[26px] leading-[1.1] text-ink group-hover:text-white">{sl.name}</span>
          {sl.venue && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{sl.venue}</span>
            </span>
          )}
          <span className="mt-1 line-clamp-2 font-serif text-[15px] leading-snug text-muted [mask-image:linear-gradient(90deg,#000_55%,transparent)]">
            {titles.slice(0, 7).join(" · ")}
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-3.5">
          <span className="flex flex-wrap gap-1.5">
            {sl.sets.map((s, i) => (
              <span key={i} className="tabular inline-flex h-6 items-center rounded-md bg-[rgb(255_236_228/0.05)] px-2 font-mono text-[11px] text-ink-2">
                {sl.sets.length > 1 ? `S${i + 1} · ` : ""}{s.items.length}
              </span>
            ))}
          </span>
          <span className="tabular inline-flex items-center gap-1.5 font-mono text-xs text-muted">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            {fmtMin(listTotal(sl))}
          </span>
        </div>
      </button>
    </li>
  );
}

function SetListDetail({
  setList,
  onBack,
  onChange,
  onDuplicate,
  onDelete,
  songs,
  byId,
  rep,
  rules,
}: {
  setList: SetList;
  onBack: () => void;
  onChange: (sl: SetList) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  songs: Song[];
  byId: Map<string, Song>;
  rep: ReturnType<typeof useRepertoire>["rep"];
  rules: ReturnType<typeof useRules>["rules"];
}) {
  const genre = GENRES[setList.genre];
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [openSong, setOpenSong] = useState<Song | null>(null);
  const setting = SETTINGS.find((s) => s.value === setList.setting)?.label;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <div className="flex flex-col gap-5">
        <Button variant="ghost" onClick={onBack} className="-ml-3 self-start text-muted">
          <ArrowLeft strokeWidth={1.75} />
          All set lists
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
            <span className="label">{setting ?? "Set list"}</span>
            <SetListName value={setList.name} onChange={(name) => onChange({ ...setList, name })} className="sm:text-[56px] sm:leading-[1.02]" />
            <SetListMeta setList={setList} noun={genre.noun} showPlace={false} />
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={setList.date ?? ""} onChange={(e) => onChange({ ...setList, date: e.target.value || undefined })} aria-label="Date" className="tabular w-full font-mono sm:w-[180px]" />
              <div className="relative w-full sm:w-64">
                <MapPin className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
                <Input value={setList.venue ?? ""} onChange={(e) => onChange({ ...setList, venue: e.target.value || undefined })} placeholder="Venue" aria-label="Venue" className="pl-10" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:pt-8">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgb(255_43_69/0.35)] bg-[rgb(255_43_69/0.06)] py-1.5 pr-1.5 pl-3.5">
                <span className="text-[13px] text-ink">Delete this set list for good?</span>
                <Button variant="danger" size="sm" onClick={onDelete}><Trash2 strokeWidth={1.75} />Delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            ) : (
              <>
                <Button variant="primary" onClick={() => setExporting(true)}><Share strokeWidth={1.75} />Export</Button>
                <Button onClick={onDuplicate}><Copy strokeWidth={1.75} />Duplicate</Button>
                <Button variant="danger" size="icon" className="h-10 w-10" onClick={() => setConfirming(true)} aria-label="Delete set list" title="Delete set list">
                  <Trash2 strokeWidth={1.75} />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <BuilderNotes notes={setList.notes} />
      <SetListEditor setList={setList} onChange={onChange} songs={songs} byId={byId} genre={genre} rep={rep} rules={rules} onOpenSong={setOpenSong} />
      <ExportDialog setList={setList} songs={byId} open={exporting} onClose={() => setExporting(false)} />
      <SongSheet song={openSong} genre={genre} onClose={() => setOpenSong(null)} />
    </div>
  );
}
