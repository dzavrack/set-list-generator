"use client";
import { useMemo } from "react";
import { ListMusic, Pencil, Star, Trash2 } from "lucide-react";
import type { GenreConfig, Song } from "@/lib/types";
import { useCustomSongs, useRepertoire, useSetLists } from "@/lib/state";
import { Sheet, SheetHeader } from "@/components/ui/Sheet";
import { StatusPicker } from "@/components/ui/Status";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/Toast";
import { AboutTune } from "./AboutTune";

export function SongSheet({ song, genre, onClose, onEdit }: { song: Song | null; genre: GenreConfig; onClose: () => void; onEdit?: (s: Song) => void }) {
  const { rep, setRep, setStatus, setField } = useRepertoire();
  const [setlists] = useSetLists();
  const [custom, setCustom] = useCustomSongs();
  const entry = song ? rep[song.id] : undefined;
  const styles = entry?.styles ?? song?.styles ?? [];
  const usedIn = useMemo(() => (song ? setlists.filter((sl) => sl.sets.some((s) => s.items.some((i) => i.songId === song.id))) : []), [setlists, song]);

  return (
    <Sheet open={!!song} onClose={onClose} title={song?.title ?? "Song"}>
      {song && (
        <>
          <SheetHeader onClose={onClose}>
            <p className="label flex items-center gap-2">
              {song.custom ? `Your ${genre.noun}` : song.rank ? `No. ${song.rank} in ${genre.name}` : genre.name}
              {song.hit && <span className="inline-flex items-center gap-1 text-neon-hot"><Star className="h-3 w-3 fill-current" /> Crowd favourite</span>}
            </p>
            <h2 className="mt-3 font-serif text-[40px] leading-[1.02] text-ink">{song.title}</h2>
            {(song.artist || song.year) && <p className="mt-2 text-[15px] text-ink-2">{[song.artist, song.year].filter(Boolean).join(" · ")}</p>}
          </SheetHeader>

          <div className="relative flex-1 space-y-8 overflow-y-auto px-7 pb-8">
            <section className="space-y-2.5">
              <h3 className="text-[13px] text-ink-2">How well do you know it?</h3>
              <StatusPicker size="lg" value={entry?.status} onChange={(s) => setStatus(song.id, s)} />
            </section>

            <section className="grid grid-cols-2 gap-4">
              <Field label="Your key">
                <Input value={entry?.key ?? ""} placeholder="e.g. Bb, Fm" onChange={(e) => setField(song.id, "key", e.target.value || undefined)} className="font-mono" />
              </Field>
              <Field label="Feel">
                <Select value={entry?.feel ?? ""} onChange={(e) => setField(song.id, "feel", e.target.value || undefined)}>
                  {genre.feels.map((f) => <option key={f} value={f}>{f || "Auto (from style)"}</option>)}
                </Select>
              </Field>
              <div className="col-span-2 space-y-2">
                <span className="text-[13px] text-ink-2">Styles you&apos;d play it in</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(genre.styles).map(([code, label]) => {
                    const on = styles.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setField(song.id, "styles", on ? styles.filter((s) => s !== code) : [...styles, code])}
                        className={cx("h-7 rounded-chip border px-3 text-xs transition-colors", on ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-ink" : "border-line-strong text-muted hover:text-ink")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Notes" className="col-span-2">
                <Textarea rows={3} value={entry?.notes ?? ""} placeholder="Intro, ending, singer's key, who takes the first solo…" onChange={(e) => setField(song.id, "notes", e.target.value || undefined)} />
              </Field>
            </section>

            <AboutTune song={song} genre={genre} />

            {usedIn.length > 0 && (
              <section className="space-y-2.5">
                <h3 className="text-[13px] text-ink-2">In {usedIn.length} saved set list{usedIn.length > 1 ? "s" : ""}</h3>
                <ul className="space-y-1.5">
                  {usedIn.slice(0, 5).map((sl) => (
                    <li key={sl.id} className="flex items-center gap-2.5 text-sm text-ink-2">
                      <ListMusic className="h-4 w-4 text-muted" strokeWidth={1.75} />
                      <span className="truncate">{sl.name}</span>
                      {sl.date && <span className="ml-auto shrink-0 font-mono text-xs text-muted">{sl.date}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {song.custom && (
              <section className="flex gap-2 border-t border-line pt-6">
                {onEdit && <Button size="sm" onClick={() => onEdit(song)}><Pencil strokeWidth={1.75} />Edit details</Button>}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (!confirm(`Remove “${song.title}” from your ${genre.noun}s?`)) return;
                    setCustom(custom.filter((c) => c.id !== song.id));
                    setRep((prev) => { const next = { ...prev }; delete next[song.id]; return next; });
                    onClose();
                    toast("Removed");
                  }}
                >
                  <Trash2 strokeWidth={1.75} />Remove
                </Button>
              </section>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
