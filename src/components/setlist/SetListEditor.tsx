"use client";
import { forwardRef, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Plus, TriangleAlert, X } from "lucide-react";
import type { GenreConfig, GigSet, Repertoire, Rules, SetItem, SetList, Song } from "@/lib/types";
import { checkSet, planShape, retime, setMinutes } from "@/lib/engine";
import { Card } from "@/components/ui/Page";
import { StyleTag } from "@/components/ui/Status";
import { cx } from "@/components/ui/cx";
import { SongOption, fmtMin, listTotal, searchByStatus } from "./parts";

export { fmtMin } from "./parts";

const cssEscape = (v: string) => (globalThis.CSS?.escape ? globalThis.CSS.escape(v) : v.replace(/["\\]/g, "\\$&"));

type Loc = { list: number; index: number }; // list index into `lists`; the last one is backups

/**
 * Drag ids. A song appears once per night, so items are keyed by song alone and keep the same id
 * as they move between sets. Containers are "list:<index>".
 */
const itemId = (songId: string) => `s:${songId}`;
const listId = (list: number) => `list:${list}`;

/* ---------------------------------------------------------------- rows */

interface RowProps {
  item: SetItem;
  n: number | null;
  warn?: string;
  onRemove?: () => void;
  onOpen?: () => void;
  handle?: React.HTMLAttributes<HTMLButtonElement>;
  overlay?: boolean;
  ghost?: boolean;
  style?: React.CSSProperties;
}

/** A song in a set. Purely presentational: the sortable wrapper and the drag overlay both render it. */
const RowView = forwardRef<HTMLLIElement, RowProps>(function RowView({ item, n, warn, onRemove, onOpen, handle, overlay, ghost, style }, ref) {
  const shaky = item.flags?.includes("shaky");
  const other = item.flags?.includes("other-style");
  const mins = Math.round(item.minutes);
  return (
    <li
      ref={ref}
      style={style}
      className={cx(
        "group relative flex items-center gap-2 border-b border-line py-2 pr-2 pl-1.5 transition-colors last:border-b-0 sm:gap-3 sm:pr-3 sm:pl-2",
        !overlay && "hover:bg-[color-mix(in_srgb,var(--ink)_2%,transparent)]",
        ghost && "opacity-30",
        overlay && "glow-ring list-none rounded-xl border-b-0 bg-surface-2/95 backdrop-blur-sm",
      )}
    >
      <button
        type="button"
        {...handle}
        data-drag-handle={overlay ? undefined : item.songId}
        aria-label={`Move ${item.title}`}
        className={cx("grid h-10 w-7 shrink-0 touch-none place-items-center rounded-md text-faint transition-colors hover:text-ink-2", overlay ? "cursor-grabbing text-ink-2" : "cursor-grab")}
      >
        <GripVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <span className="tabular w-5 shrink-0 text-right font-mono text-xs text-faint">{n ?? "·"}</span>
      <button type="button" onClick={onOpen} tabIndex={onOpen ? undefined : -1} className="min-w-0 flex-1 py-0.5 pl-1 text-left">
        <span className="flex items-center gap-2">
          <span className="truncate font-serif title-plain text-[18px] leading-snug text-ink group-hover:text-white sm:text-[19px]">{item.title}</span>
          {warn && (
            <span title={warn} className="shrink-0">
              <TriangleAlert className="h-3.5 w-3.5 text-neon-hot [filter:drop-shadow(0_0_4px_var(--neon))]" strokeWidth={2} aria-hidden />
              <span className="sr-only">Heads up: {warn}</span>
            </span>
          )}
        </span>
        {(item.feel || shaky || other) ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
            {item.feel && <span className="mr-0.5">{item.feel}</span>}
            {shaky && <StyleTag tone="shaky">Shaky</StyleTag>}
            {other && <StyleTag>Other style</StyleTag>}
            <span className="tabular font-mono text-[11.5px] text-faint sm:hidden">{mins}′</span>
          </span>
        ) : (
          <span className="tabular mt-0.5 block font-mono text-[11.5px] text-faint sm:hidden">{mins}′</span>
        )}
      </button>
      {item.key && <span className="shrink-0 rounded-md border border-line-strong px-1.5 py-px font-mono text-[11px] text-ink-2">{item.key}</span>}
      <span className="tabular hidden w-9 shrink-0 text-right font-mono text-xs text-muted sm:block">{mins}′</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.title}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink sm:h-9 sm:w-9"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      ) : (
        <span className="h-10 w-10 shrink-0 sm:h-9 sm:w-9" />
      )}
    </li>
  );
});

function SortableRow(props: Omit<RowProps, "handle" | "ghost" | "style" | "overlay"> & { id: string }) {
  const { id, ...rest } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <RowView
      ref={setNodeRef}
      {...rest}
      ghost={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      handle={{ ...attributes, ...listeners }}
    />
  );
}

function DropList({ list, children, empty, count }: { list: number; children: React.ReactNode; empty: string; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: listId(list) });
  return (
    <ul ref={setNodeRef} className={cx("min-h-14 border-t border-line transition-colors", isOver && "bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]")}>
      {children}
      {count === 0 && (
        <li className={cx("m-3 rounded-xl border border-dashed px-4 py-5 text-center text-[13px] text-faint transition-colors", isOver ? "border-[color-mix(in_srgb,var(--accent)_50%,transparent)] text-ink-2" : "border-line-strong")}>{empty}</li>
      )}
    </ul>
  );
}

/* ---------------------------------------------------------------- add a song */

function AddSong({ songs, rep, exclude, onAdd, noun }: { songs: Song[]; rep: Repertoire; exclude: Set<string>; onAdd: (s: Song) => void; noun: string }) {
  const [q, setQ] = useState("");
  const res = useMemo(() => searchByStatus(songs.filter((s) => !exclude.has(s.id)), q, rep), [songs, exclude, q, rep]);
  const pick = (s: Song) => { onAdd(s); setQ(""); };
  return (
    <div className="relative border-t border-line">
      <Plus className="pointer-events-none absolute top-1/2 left-[18px] h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && res[0]) { e.preventDefault(); pick(res[0]); }
          if (e.key === "Escape") setQ("");
        }}
        placeholder={`Add a ${noun}`}
        aria-label={`Add a ${noun}`}
        className="h-12 w-full rounded-b-2xl bg-transparent pr-4 pl-11 text-sm text-ink placeholder:text-muted transition-[background-color,box-shadow] duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_2%,transparent)] focus:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_55%,transparent),inset_0_0_0_4px_color-mix(in_srgb,var(--accent)_12%,transparent)] focus:outline-none focus-visible:outline-none"
      />
      {res.length > 0 && (
        <ul className="absolute inset-x-2 top-full z-30 -mt-1 overflow-hidden rounded-xl border border-line-strong bg-surface-2 py-1 shadow-[0_20px_60px_rgb(0_0_0/0.7)]">
          {res.map((s, i) => (
            <li key={s.id}>
              <SongOption song={s} status={rep[s.id]?.status} onPick={() => pick(s)} active={i === 0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- set card */

function SetHeader({ set, target, messages, first }: { set: GigSet; target: number; messages: string[]; first: number }) {
  const [open, setOpen] = useState(false);
  const mins = setMinutes(set);
  const pct = target ? Math.min(100, (mins / target) * 100) : 0;
  const diff = target ? mins - target : 0;
  const last = first + set.items.length - 1;
  return (
    <header className="px-5 pt-4 pb-4 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-[28px] leading-none text-ink">{set.name}</h3>
        <span className="tabular font-mono text-xs text-muted">
          {set.items.length ? `${first}–${last}` : "0"} · {fmtMin(mins)}
          {target > 0 && <span className="text-faint"> / {fmtMin(target)}</span>}
        </span>
      </div>
      {target > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-surface-3" role="meter" aria-label={`${set.name} length`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={mins}>
            <div className="tube-h h-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          {Math.abs(diff) >= 3 && (
            <span className={cx("tabular shrink-0 font-mono text-[11px]", diff > 0 ? "text-neon-hot" : "text-muted")}>
              {diff > 0 ? `+${diff}` : diff} min
            </span>
          )}
        </div>
      )}
      {messages.length > 0 && (
        <div className="mt-3 flex items-start gap-2 text-[13px] text-ink-2">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-hot" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            {open ? (
              <ul className="flex flex-col gap-1">{messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
            ) : (
              <p className="truncate" title={messages[0]}>{messages[0]}</p>
            )}
          </div>
          {messages.length > 1 && (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="-my-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink">
              {open ? "Less" : `+${messages.length - 1}`}
              <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
    </header>
  );
}

/* ---------------------------------------------------------------- editor */

export function SetListEditor({
  setList,
  onChange,
  songs,
  byId,
  genre,
  rep,
  rules,
  onOpenSong,
}: {
  setList: SetList;
  onChange: (sl: SetList) => void;
  songs: Song[];
  byId: Map<string, Song>;
  genre: GenreConfig;
  rep: Repertoire;
  rules: Rules;
  onOpenSong?: (s: Song) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const lists = useMemo(() => [...setList.sets.map((s) => s.items), setList.backups], [setList]);
  const B = setList.sets.length; // index of backups in `lists`
  const noun = genre.noun;

  const locate = (id: string): Loc | null => {
    if (id.startsWith("list:")) {
      const list = Number(id.slice(5));
      return lists[list] ? { list, index: lists[list].length } : null;
    }
    const songId = id.slice(2);
    for (let list = 0; list < lists.length; list++) {
      const index = lists[list].findIndex((i) => i.songId === songId);
      if (index >= 0) return { list, index };
    }
    return null;
  };

  const commit = (next: SetItem[][]) => {
    const sl: SetList = {
      ...setList,
      sets: setList.sets.map((s, i) => ({ ...s, items: next[i] })),
      backups: next[B],
      updatedAt: new Date().toISOString(),
    };
    onChange(retime(sl, songs, rep, rules, genre));
  };

  const move = (from: Loc, to: Loc) => {
    const next = lists.map((l) => l.slice());
    if (from.list === to.list) next[from.list] = arrayMove(next[from.list], from.index, Math.min(to.index, next[from.list].length - 1));
    else {
      const [it] = next[from.list].splice(from.index, 1);
      next[to.list].splice(to.index, 0, it);
    }
    commit(next);
  };

  const onDragStart = (e: DragStartEvent) => setActive(String(e.active.id));
  /** A row moved between sets remounts, so hand focus back to its handle once the drop settles. */
  const refocus = (id: string) => {
    const sid = id.slice(2);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag-handle="${cssEscape(sid)}"]`)?.focus({ preventScroll: true })),
    );
  };
  const onDragOver = (e: DragOverEvent) => {
    if (!e.over) return;
    const from = locate(String(e.active.id));
    const to = locate(String(e.over.id));
    if (!from || !to || from.list === to.list) return;
    move(from, to);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    refocus(String(e.active.id));
    if (!e.over) return;
    const from = locate(String(e.active.id));
    const to = locate(String(e.over.id));
    if (from && to && from.list === to.list && from.index !== to.index) move(from, to);
  };

  const remove = (list: number, index: number) => {
    const next = lists.map((l) => l.slice());
    next[list].splice(index, 1);
    commit(next);
  };

  const inNight = useMemo(() => new Set(lists.flat().map((i) => i.songId)), [lists]);
  const add = (list: number, s: Song) => {
    const e = rep[s.id];
    const next = lists.map((l) => l.slice());
    next[list].push({ songId: s.id, title: s.title, artist: s.artist, key: e?.key, feel: e?.feel, minutes: 5, flags: ["picked"] });
    commit(next);
  };

  /** Per-row warning (first one wins) and every message per set. */
  const { rowWarn, setWarn } = useMemo(() => {
    const rowWarn = new Map<string, string>();
    const setWarn: string[][] = setList.sets.map(() => []);
    setList.sets.forEach((set, si) => {
      for (const w of checkSet(set, { setIndex: si, songs, rep, rules, genre, setting: setList.setting })) {
        if (!setWarn[si].includes(w.message)) setWarn[si].push(w.message);
        if (w.itemIndex != null) {
          const it = set.items[w.itemIndex];
          if (it && !rowWarn.has(it.songId)) rowWarn.set(it.songId, w.message);
        }
      }
    });
    return { rowWarn, setWarn };
  }, [setList, songs, rep, rules, genre]);

  const target = useMemo(() => {
    if (!setList.request || setList.request.count) return 0;
    return planShape(setList.request, rules).minutesPerSet;
  }, [setList.request, rules]);

  /* Screen reader copy: song titles and set names, never raw drag ids. */
  const listName = (l: number) => (l === B ? "Backups" : setList.sets[l]?.name ?? "the set");
  const titleOf = (id: string | number) => {
    const loc = locate(String(id));
    return loc && !String(id).startsWith("list:") ? lists[loc.list][loc.index]?.title ?? noun : noun;
  };
  const whereOf = (id: string | number) => {
    const loc = locate(String(id));
    if (!loc) return "";
    return String(id).startsWith("list:") ? `the end of ${listName(loc.list)}` : `${listName(loc.list)}, position ${loc.index + 1}`;
  };
  const accessibility = {
    screenReaderInstructions: {
      draggable: `To move a ${noun}, press space or enter to pick it up. Use the arrow keys to move it, within a set or into another set or the backups. Press space or enter again to drop it, or escape to cancel.`,
    },
    announcements: {
      onDragStart: ({ active }: { active: { id: string | number } }) => `Picked up ${titleOf(active.id)} from ${whereOf(active.id)}.`,
      onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over ? `${titleOf(active.id)} is over ${whereOf(over.id)}.` : `${titleOf(active.id)} is no longer over a set.`,
      onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over ? `Dropped ${titleOf(active.id)} at ${whereOf(over.id)}.` : `Dropped ${titleOf(active.id)}.`,
      onDragCancel: ({ active }: { active: { id: string | number } }) => `Cancelled. ${titleOf(active.id)} stays at ${whereOf(active.id)}.`,
    },
  };

  const activeLoc = active ? locate(active) : null;
  const activeItem = activeLoc ? lists[activeLoc.list][activeLoc.index] : null;
  const offsets = setList.sets.map((_, i) => setList.sets.slice(0, i).reduce((a, s) => a + s.items.length, 0));
  const open = (it: SetItem) => () => {
    const s = byId.get(it.songId);
    if (s && onOpenSong) onOpenSong(s);
  };

  return (
    <DndContext accessibility={accessibility} sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="@container flex flex-col gap-5">
        <div className={cx("grid items-start gap-5", setList.sets.length > 1 && "@3xl:grid-cols-2", setList.sets.length > 2 && "@7xl:grid-cols-3")}>
          {setList.sets.map((set, si) => (
            <Card key={si} aria-label={set.name} role="region" className="min-w-0">
              <SetHeader set={set} target={target} messages={setWarn[si]} first={offsets[si] + 1} />
              <SortableContext items={set.items.map((i) => itemId(i.songId))} strategy={verticalListSortingStrategy}>
                <DropList list={si} count={set.items.length} empty={`Drag ${noun}s here`}>
                  {set.items.map((it, ii) => (
                    <SortableRow
                      key={it.songId}
                      id={itemId(it.songId)}
                      item={it}
                      n={offsets[si] + ii + 1}
                     
                      warn={rowWarn.get(it.songId)}
                      onRemove={() => remove(si, ii)}
                      onOpen={open(it)}
                    />
                  ))}
                </DropList>
              </SortableContext>
              <AddSong songs={songs} rep={rep} exclude={inNight} onAdd={(s) => add(si, s)} noun={noun} />
            </Card>
          ))}
        </div>

        <Card role="region" aria-label="Backups">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-4 sm:px-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-serif text-[24px] leading-none text-ink">Backups</h3>
              <span className="text-[13px] text-muted">Drag one into a set to swap it in</span>
            </div>
            <span className="tabular font-mono text-xs text-muted">Night total {fmtMin(listTotal(setList))}</span>
          </header>
          <SortableContext items={setList.backups.map((i) => itemId(i.songId))} strategy={verticalListSortingStrategy}>
            <DropList list={B} count={setList.backups.length} empty={`No backups yet. Drag ${noun}s here to keep them handy.`}>
              {setList.backups.map((it, ii) => (
                <SortableRow key={it.songId} id={itemId(it.songId)} item={it} n={null} onRemove={() => remove(B, ii)} onOpen={open(it)} />
              ))}
            </DropList>
          </SortableContext>
          <AddSong songs={songs} rep={rep} exclude={inNight} onAdd={(s) => add(B, s)} noun={`backup ${noun}`} />
        </Card>
      </div>
      <DragOverlay>
        {activeItem ? (
          <ul>
            <RowView item={activeItem} n={null} warn={rowWarn.get(activeItem.songId)} overlay />
          </ul>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
