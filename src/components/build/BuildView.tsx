"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  BookOpenText,
  Bookmark,
  BookmarkCheck,
  Calendar,
  CircleSlash,
  Clock,
  Flame,
  GripVertical,
  Info,
  Layers,
  ListMusic,
  MapPin,
  Mic,
  Music,
  RefreshCw,
  Search,
  Share,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Book, GenreConfig, GigRequest, Rules, SetList, Song } from "@/lib/types";
import { SETTINGS } from "@/lib/types";
import { GENRES } from "@/lib/genres";
import { buildSetList, decadeLabel, parseGigRequest, planShape, splitStyles, TEMPO_LABELS } from "@/lib/engine";
import { useSongs } from "@/lib/catalog";
import { useBooks, useCustomSongs, useGenre, useRepertoire, useSetLists } from "@/lib/state";
import { removeKey } from "@/lib/storage";
import { useRules } from "@/lib/rules";
import { Button, buttonBase, buttonSizes, buttonVariants } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Input, Toggle } from "@/components/ui/Field";
import { Card, CardHeader, PageHeader } from "@/components/ui/Page";
import { Sheet, SheetHeader } from "@/components/ui/Sheet";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/Toast";
import { SetListEditor } from "@/components/setlist/SetListEditor";
import { BuilderNotes, SetListMeta, SetListName, SongOption, fmtMin, prettyDate, searchByStatus } from "@/components/setlist/parts";
import { SongSheet } from "@/components/repertoire/SongSheet";
import { ExportDialog } from "@/components/export/ExportDialog";
import { GigForm, LengthFields } from "./GigForm";

const blankRequest = (): GigRequest => ({ styles: [], setting: "standard", allowShaky: false });

/** Which songs sit where. Changes when the sets are edited, not when the name is. */
const signature = (sl: SetList) => [...sl.sets.map((s) => s.items.map((i) => i.songId).join(",")), sl.backups.map((i) => i.songId).join(",")].join("|");

/* ---------------------------------------------------------------- understood */

type Pill = { icon: LucideIcon; label: string; key: string; onRemove?: () => void; removeLabel?: string };

/** The parsed request as a row of facts instead of a sentence. */
function understood(req: GigRequest, genre: GenreConfig, rules: Rules, books: Book[], byId: Map<string, Song>, setReq: (r: GigRequest) => void): Pill[] {
  const out: Pill[] = [];
  const shape = planShape(req, rules);
  const many = `${genre.noun}s`;
  if (shape.count) out.push({ key: "count", icon: ListMusic, label: `${shape.count} ${many}` });
  else {
    out.push({ key: "len", icon: Clock, label: fmtMin(shape.totalMinutes) });
    out.push({ key: "sets", icon: Layers, label: `${shape.sets} set${shape.sets > 1 ? "s" : ""} × ${shape.minutesPerSet} min` });
  }
  const picks = req.picks?.length ? req.picks : null;
  const { styles, tempo } = splitStyles(req.styles || [], genre);
  if (picks) out.push({ key: "picks", icon: ListMusic, label: `${picks.length} picked${req.keepOrder ? ", your order" : ""}` });
  else out.push({ key: "styles", icon: Music, label: styles.length ? styles.map((c) => genre.styles[c] || c).join(" + ") : "Any style" });
  if (tempo.length) out.push({ key: "tempo", icon: Flame, label: tempo.map((c) => genre.styles[c] || TEMPO_LABELS[c] || c).join(", ") });
  if (req.decades?.length) out.push({ key: "dec", icon: Calendar, label: req.decades.map(decadeLabel).join(" + ") });
  out.push({ key: "setting", icon: Mic, label: SETTINGS.find((x) => x.value === req.setting)?.label || "Standard gig" });
  if (req.date) out.push({ key: "date", icon: Calendar, label: prettyDate(req.date, false) });
  if (req.venue) out.push({ key: "venue", icon: MapPin, label: req.venue });
  if (req.bookId) out.push({ key: "book", icon: BookOpenText, label: books.find((b) => b.id === req.bookId)?.name ?? "A saved list" });
  if (req.favourites) out.push({ key: "fav", icon: Star, label: "Crowd favourites" });
  if (!req.allowShaky) out.push({ key: "shaky", icon: CircleSlash, label: `No shaky ${many}` });
  for (const id of req.exclude ?? []) {
    const title = byId.get(id)?.title ?? id;
    out.push({
      key: `ex:${id}`,
      icon: CircleSlash,
      label: `No ${title}`,
      removeLabel: `Allow ${title} again`,
      onRemove: () => setReq({ ...req, exclude: (req.exclude ?? []).filter((x) => x !== id) }),
    });
  }
  return out;
}

function Pills({ pills, dim }: { pills: Pill[]; dim?: boolean }) {
  return (
    <ul className={cx("flex flex-wrap gap-1.5 transition-opacity duration-150", dim && "opacity-45")}>
      {pills.map(({ key, icon: Icon, label, onRemove, removeLabel }) => (
        <li key={key} className={cx("inline-flex h-7 max-w-full items-center gap-1.5 rounded-chip border border-line-strong bg-surface-2/70 pl-2.5 text-[12.5px] text-ink-2", onRemove ? "pr-0.5" : "pr-3")}>
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.75} />
          <span className="truncate">{label}</span>
          {onRemove && (
            <button type="button" onClick={onRemove} aria-label={removeLabel} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-ink">
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- empty states */

function EmptyDraft({ noun }: { noun: string }) {
  const points: [LucideIcon, string, string][] = [
    [Sparkles, "Opens strong, closes hot", `Your surest up-tempo ${noun}s go first and last.`],
    [Clock, "Fills the time", "Paces ballads and feels, and splits the night into sets."],
    [ShieldCheck, "Plays it safe", `Only ${noun}s you know. Shaky ones stay off the edges.`],
    [GripVertical, "Yours to rearrange", "Drag between sets, swap in backups, then save it."],
  ];
  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] h-80 w-[70%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_13%,transparent),transparent)] blur-2xl" />
      <div className="relative flex flex-col px-6 pt-12 pb-8 sm:px-10 sm:pt-16">
        <div className="flex items-center gap-3">
          <span className="tube-h w-8" />
          <span className="label !text-neon-hot">Nothing on the stand yet</span>
        </div>
        <p className="mt-6 max-w-[18ch] font-serif text-[40px] leading-[1.02] tracking-[-0.01em] text-ink sm:text-[52px]">
          Tell it about the gig. It&rsquo;ll hand you the night.
        </p>
        <p className="mt-4 max-w-md text-[15px] text-ink-2">
          Describe it the way you&rsquo;d text the band. The builder turns that into sets from your repertoire, with backups ready.
        </p>
        <ul className="mt-10 grid gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-2">
          {points.map(([Icon, title, body]) => (
            <li key={title} className="flex gap-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control border border-line-strong bg-surface-2">
                <Icon className="h-4 w-4 text-ink-2" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function NothingKnown({ noun }: { noun: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="mb-1 grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-surface-2">
        <BookOpenText className="h-5 w-5 text-neon-hot" strokeWidth={1.75} />
      </span>
      <p className="font-serif text-[30px] leading-tight text-ink">Mark some {noun}s as Know it first</p>
      <p className="max-w-md text-sm text-muted">
        The builder only reaches for {noun}s you can call on the bandstand. Sort a few in your repertoire and come back.
      </p>
      <p className="max-w-md text-sm text-ink-2">
        Already have a set list? Paste it into <span className="text-ink">Import a list</span> on the Repertoire page and every {noun} on it is marked Know it in one go.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link href="/repertoire/" className={cx(buttonBase, buttonSizes.md, buttonVariants.primary)}>
          Sort your repertoire
          <ArrowRight strokeWidth={1.75} />
        </Link>
        <Link href="/repertoire/" className={cx(buttonBase, buttonSizes.md, buttonVariants.secondary)}>
          Import a set list
        </Link>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- view */

type Confirm = { title: string; body: string; action: string; run: () => void };

export function BuildView() {
  const [genreKey] = useGenre();
  const genre = GENRES[genreKey];
  const noun = genre.noun;
  const [custom] = useCustomSongs();
  const { songs, byId, loading } = useSongs(genreKey, custom);
  const { rep } = useRepertoire();
  const { rules } = useRules(genreKey);
  const [books] = useBooks();
  const [setlists, setSetlists] = useSetLists();
  const myBooks = useMemo(() => books.filter((b) => b.genre === genreKey), [books, genreKey]);

  const [mode, setMode] = useState<"describe" | "pick">("describe");
  const [text, setText] = useState("");
  const [req, setReq] = useState<GigRequest | null>(null);
  const [adjust, setAdjust] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [pickQ, setPickQ] = useState("");
  const [keepOrder, setKeepOrder] = useState(true);
  // The draft lives for this visit only: the page always opens on the empty card, and a set list
  // appears once the player builds one. Saving it puts it in Set lists for good.
  const [draft, setDraft] = useState<SetList | null>(null);
  /** Signature of the sets as the builder dealt them, to tell whether the player has edited since. */
  const [builtSig, setBuiltSig] = useState<string | null>(null);
  // Tidy up drafts an earlier version kept in the browser.
  useEffect(() => {
    removeKey(`draft:${genreKey}`);
    removeKey(`draft-sig:${genreKey}`);
  }, [genreKey]);
  const [seed, setSeed] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [openSong, setOpenSong] = useState<Song | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const draftRef = useRef<HTMLElement>(null);

  const known = useMemo(() => songs.filter((s) => rep[s.id]?.status === "know").length, [songs, rep]);
  const recent = useMemo(() => setlists.filter((s) => s.genre === genreKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [setlists, genreKey]);
  const canBuild = !loading && known > 0;

  const [parsedText, setParsedText] = useState<string | null>(null);
  const parse = (t: string) => {
    const { request } = parseGigRequest(t, genre, undefined, { books: myBooks, songs });
    setReq(request);
    setParsedText(t);
    return request;
  };
  const parseRef = useRef(parse);
  useEffect(() => { parseRef.current = parse; });
  // Re-read the description shortly after typing stops, so "Understood" never goes stale.
  const stale = !!text.trim() && text !== parsedText;
  useEffect(() => {
    if (!stale || loading) return;
    const t = setTimeout(() => parseRef.current(text), 450);
    return () => clearTimeout(t);
  }, [text, stale, loading]);

  const saved = !!draft && setlists.some((s) => s.id === draft.id && s.updatedAt === draft.updatedAt);
  const dirty = !!draft && builtSig !== null && signature(draft) !== builtSig;

  const build = (r: GigRequest, s = seed, keep?: SetList) => {
    if (!canBuild) return;
    let sl = buildSetList({ request: r, songs, rep, rules, genre, recent, books: myBooks, seed: s, now: new Date().toISOString() });
    // A reshuffle is the same night: keep its identity so saving updates rather than duplicates.
    if (keep) sl = { ...sl, id: keep.id, name: keep.name, date: keep.date, venue: keep.venue, createdAt: keep.createdAt };
    setDraft(sl);
    setBuiltSig(signature(sl));
    setDiscarding(false);
    if (sl.notes.length) toast(sl.notes[0]);
    // On phones the draft sits below the composer: bring it into view.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  /** Building fresh replaces the draft: ask first if it has unsaved edits. */
  const guard = (run: () => void) => {
    if (draft && dirty && !saved) {
      setConfirm({ title: "Replace this draft?", body: `You've rearranged “${draft.name}” and haven't saved it. Building again starts a new set list.`, action: "Build a new one", run });
    } else run();
  };

  const submitDescribe = (e?: React.FormEvent) => {
    e?.preventDefault();
    guard(() => {
      // Re-parse only when the description changed, so manual adjustments survive "Build again".
      const r = text.trim() && text !== parsedText ? parse(text) : req ?? blankRequest();
      if (!req) setReq(r);
      build(r);
    });
  };

  const tryChip = (prompt: string) =>
    guard(() => {
      setText(prompt);
      build(parse(prompt));
    });

  const submitPick = () =>
    guard(() => {
      const r: GigRequest = { ...(req ?? blankRequest()), picks, keepOrder };
      setReq(r);
      build(r);
    });

  const shuffle = () => {
    if (!draft?.request) return;
    const run = () => {
      const s = seed + 1;
      setSeed(s);
      build(draft.request!, s, draft);
    };
    if (dirty) setConfirm({ title: "Shuffle this set list?", body: "Shuffle deals a fresh order and will replace your changes to the sets. The name, date and venue stay.", action: "Shuffle anyway", run });
    else run();
  };

  const save = () => {
    if (!draft) return;
    const exists = setlists.some((s) => s.id === draft.id);
    setSetlists(exists ? setlists.map((s) => (s.id === draft.id ? draft : s)) : [draft, ...setlists]);
    toast(exists ? "Set list updated" : "Saved to Set lists");
  };

  const pickRes = useMemo(() => searchByStatus(songs.filter((s) => !picks.includes(s.id)), pickQ, rep, 8), [songs, picks, pickQ, rep]);
  const addPick = (s: Song) => { setPicks([...picks, s.id]); setPickQ(""); };
  const pills = req ? understood(req, genre, rules, myBooks, byId, setReq) : [];
  // One primary per view: the composer's button leads until there's a draft to save.
  const composeVariant = draft ? "secondary" : "primary";
  const knownLine = known === 0 ? `No ${noun}s are marked Know it yet.` : known === 1 ? `Only 1 ${noun} is marked Know it.` : `Only ${known} ${noun}s are marked Know it.`;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PageHeader
        title="Build a set"
        description={`Describe the gig in plain words. The builder picks from the ${noun}s you know, paces the night and leaves you backups.`}
        actions={
          !loading && (
            <Link href="/repertoire/" className="tabular inline-flex h-9 items-center gap-2 rounded-chip border border-line-strong px-3.5 font-mono text-xs text-ink-2 transition-colors hover:border-[color-mix(in_srgb,var(--ink)_22%,transparent)] hover:text-ink">
              <span className={cx("h-1.5 w-1.5 rounded-full", known ? "bg-know shadow-[0_0_8px_var(--neon)]" : "bg-skip")} />
              {known.toLocaleString()} {noun}{known === 1 ? "" : "s"} ready
            </Link>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)] xl:gap-8">
        {/* ---------- The gig ---------- */}
        <aside className={cx("min-w-0", mode === "describe" && !adjust && "lg:sticky lg:top-6")}>
          <Card>
            <CardHeader
              title="The gig"
              className="items-center px-5 sm:px-6"
              actions={
                <Segmented
                  size="sm"
                  label="How to build"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "describe", label: <><WandSparkles strokeWidth={1.75} />Describe</> },
                    { value: "pick", label: <><ListMusic strokeWidth={1.75} />Pick {noun}s</> },
                  ]}
                />
              }
            />

            {mode === "describe" ? (
              <form onSubmit={submitDescribe} className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="rounded-xl border border-line-strong bg-surface-2/60 transition-[border-color,box-shadow] duration-150 focus-within:border-[color-mix(in_srgb,var(--accent)_60%,transparent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_15%,transparent),0_0_32px_-10px_var(--neon-glow)]">
                  <div className="flex items-start gap-3 px-4 pt-4">
                    <Sparkles className="mt-1.5 h-4 w-4 shrink-0 text-neon-hot [filter:drop-shadow(0_0_6px_var(--neon))]" strokeWidth={1.75} />
                    <textarea
                      rows={3}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitDescribe(); } }}
                      aria-label="Describe the gig"
                      placeholder={genre.chips[0]?.[1] ?? "2 hour gig Friday night"}
                      className="min-h-[84px] w-full resize-none bg-transparent font-serif title-plain text-[20px] leading-snug text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 pt-1 pb-3 pl-4">
                    <span className="hidden font-mono text-[11px] text-faint sm:inline">Enter to build</span>
                    <span className="sm:hidden" />
                    <Button type="submit" size="sm" variant={composeVariant} disabled={!canBuild} className="h-9 px-3.5">
                      {draft ? <RefreshCw strokeWidth={1.75} /> : <ArrowUp strokeWidth={2} />}
                      {draft ? "Build again" : "Build"}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="label">Try one</span>
                  <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
                    {genre.chips.map(([label, prompt]) => (
                      <button
                        key={label}
                        type="button"
                        title={prompt}
                        disabled={!canBuild}
                        onClick={() => tryChip(prompt)}
                        className="h-8 shrink-0 rounded-chip border border-line-strong px-3.5 text-[13px] text-ink-2 transition-colors hover:border-[color-mix(in_srgb,var(--ink)_22%,transparent)] hover:text-ink disabled:opacity-40"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {req ? (
                  <div className="flex flex-col gap-3 border-t border-line pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="label flex items-center gap-2">
                        Understood
                        {stale && <span className="normal-case tracking-normal text-faint">· reading…</span>}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => setAdjust((a) => !a)} aria-expanded={adjust} className="-mr-2">
                        {adjust ? <X strokeWidth={1.75} /> : <SlidersHorizontal strokeWidth={1.75} />}
                        {adjust ? "Done" : "Adjust"}
                      </Button>
                    </div>
                    <Pills pills={pills} dim={stale} />
                    {adjust && (
                      <div className="mt-2 rounded-xl border border-line bg-panel/60 p-4 sm:p-5">
                        <GigForm req={req} onChange={setReq} genre={genre} books={myBooks} songs={songs} rep={rep} />
                      </div>
                    )}
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => { setReq(blankRequest()); setAdjust(true); }} className="-ml-2 self-start text-muted">
                    <SlidersHorizontal strokeWidth={1.75} />
                    Or fill in the details yourself
                  </Button>
                )}
              </form>
            ) : (
              <div className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
                  <Input
                    type="search"
                    value={pickQ}
                    onChange={(e) => setPickQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && pickRes[0]) { e.preventDefault(); addPick(pickRes[0]); } }}
                    placeholder={`Search ${noun}s to add`}
                    aria-label={`Search ${noun}s`}
                    className="pl-10"
                  />
                  {pickRes.length > 0 && (
                    <ul className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line-strong bg-surface-2 py-1 shadow-[0_20px_60px_rgb(0_0_0/0.7)]">
                      {pickRes.map((s, i) => (
                        <li key={s.id}>
                          <SongOption song={s} status={rep[s.id]?.status} onPick={() => addPick(s)} active={i === 0} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {picks.length ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="label">Picked · {picks.length}</span>
                      <Button size="sm" variant="ghost" onClick={() => setPicks([])} className="-mr-2">Clear</Button>
                    </div>
                    <ol className="overflow-hidden rounded-xl border border-line">
                      {picks.map((id, i) => (
                        <li key={id} className="flex items-center gap-3 border-b border-line py-1 pr-1 pl-3.5 last:border-b-0">
                          <span className="tabular w-5 text-right font-mono text-xs text-faint">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate font-serif title-plain text-[17px] text-ink">{byId.get(id)?.title ?? id}</span>
                          <button type="button" aria-label={`Remove ${byId.get(id)?.title ?? id}`} onClick={() => setPicks(picks.filter((p) => p !== id))} className="grid h-10 w-10 place-items-center rounded-lg text-faint transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink">
                            <X className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-8 text-center">
                    <ListMusic className="h-5 w-5 text-muted" strokeWidth={1.75} />
                    <p className="max-w-[30ch] text-[13px] text-muted">Picked {noun}s land here. The builder splits them into sets and fills out the time.</p>
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-line pt-5">
                  <LengthFields req={req ?? blankRequest()} onChange={setReq} genre={genre} optional />
                  <p className="text-xs text-faint">Give it a length and the builder fills the rest with {noun}s you know. Leave it blank to play just your picks.</p>
                </div>
                <Toggle checked={keepOrder} onChange={setKeepOrder} label="Keep my order" hint="Otherwise the builder paces them for you" />
                <Button variant={composeVariant} size="lg" onClick={submitPick} disabled={!picks.length || !canBuild}>
                  <WandSparkles strokeWidth={1.75} />
                  Build from {picks.length} picked
                </Button>
              </div>
            )}

            {known < 10 && !loading && (
              <div className="flex gap-3 border-t border-line px-5 py-4 text-[13px] text-ink-2 sm:px-6">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                <p>
                  {knownLine}{" "}
                  <Link href="/repertoire/" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-neon-hot">Sort your repertoire</Link> for better set lists, or paste a set list you already play into Import a list there and every {noun} on it is marked Know it.
                </p>
              </div>
            )}
          </Card>
        </aside>

        {/* ---------- Draft ---------- */}
        <section ref={draftRef} aria-label="Draft set list" className="min-w-0 scroll-mt-20">
          {draft ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <span className="label flex items-center gap-2">
                  <span className={cx("h-1.5 w-1.5 rounded-full", saved ? "bg-know shadow-[0_0_8px_var(--neon)]" : "bg-muted")} />
                  {saved ? "Saved" : dirty ? "Draft · edited" : "Draft"}
                </span>
                <SetListName value={draft.name} onChange={(name) => setDraft({ ...draft, name, updatedAt: new Date().toISOString() })} />
                <SetListMeta setList={draft} noun={noun} />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button onClick={shuffle} disabled={!draft.request || !canBuild}><Shuffle strokeWidth={1.75} />Shuffle</Button>
                  <Button onClick={() => setExporting(true)}><Share strokeWidth={1.75} />Export</Button>
                  <Button variant="primary" onClick={save} disabled={saved || !draft.sets.some((s) => s.items.length)}>
                    {saved ? <BookmarkCheck strokeWidth={1.75} /> : <Bookmark strokeWidth={1.75} />}
                    {saved ? "Saved" : "Save"}
                  </Button>
                  {discarding ? (
                    <span className="flex items-center gap-1.5">
                      <span className="px-1 text-[13px] text-ink-2">Discard this draft?</span>
                      <Button variant="danger" size="sm" onClick={() => { setDraft(null); setDiscarding(false); }}>Discard</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDiscarding(false)}>Keep</Button>
                    </span>
                  ) : (
                    <Button variant="ghost" onClick={() => (saved ? setDraft(null) : setDiscarding(true))}><Trash2 strokeWidth={1.75} />Discard</Button>
                  )}
                </div>
              </div>
              <BuilderNotes notes={draft.notes} />
              <SetListEditor setList={draft} onChange={setDraft} songs={songs} byId={byId} genre={genre} rep={rep} rules={rules} onOpenSong={setOpenSong} />
              <ExportDialog setList={draft} songs={byId} open={exporting} onClose={() => setExporting(false)} />
            </div>
          ) : !loading && known === 0 ? (
            <NothingKnown noun={noun} />
          ) : (
            <EmptyDraft noun={noun} />
          )}
        </section>
      </div>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title ?? "Confirm"} side="center" className="mx-auto sm:max-w-[460px]">
        <SheetHeader onClose={() => setConfirm(null)}>
          <p className="font-serif text-[30px] leading-tight text-ink">{confirm?.title}</p>
          <p className="mt-2 text-sm text-ink-2">{confirm?.body}</p>
        </SheetHeader>
        <div className="flex flex-wrap justify-end gap-2 px-7 pb-7">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Keep my changes</Button>
          <Button variant="danger" onClick={() => { const run = confirm?.run; setConfirm(null); run?.(); }}>{confirm?.action}</Button>
        </div>
      </Sheet>
      <SongSheet song={openSong} genre={genre} onClose={() => setOpenSong(null)} />
    </div>
  );
}
