"use client";
import { useState } from "react";
import { Check, Info, Plus } from "lucide-react";
import type { GenreConfig, Song, Status } from "@/lib/types";
import { normalizeTitle } from "@/lib/catalog";
import { useCustomSongs, useRepertoire } from "@/lib/state";
import { Sheet, SheetHeader } from "@/components/ui/Sheet";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/Toast";

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

type Props = { open: boolean; onClose: () => void; genre: GenreConfig; songs: Song[]; editing?: Song | null };

export function AddSongSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.editing ? "Edit song" : "Add your own"}>
      {props.open && <AddSongForm key={props.editing?.id ?? "new"} {...props} />}
    </Sheet>
  );
}

function AddSongForm({ onClose, genre, songs, editing }: Props) {
  const [custom, setCustom] = useCustomSongs();
  const { rep, setRep } = useRepertoire();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [artist, setArtist] = useState(editing?.artist ?? "");
  const [year, setYear] = useState(editing?.year ? String(editing.year) : "");
  const [status, setStatus] = useState<Status>((editing && rep[editing.id]?.status) || "know");
  const [styles, setStyles] = useState<string[]>(editing?.styles ?? []);

  const dupe = !editing && title.trim().length > 1 ? songs.find((s) => normalizeTitle(s.title) === normalizeTitle(title)) : undefined;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const song: Song = {
      id: editing?.id ?? `my-${genre.key}-${slug(t)}-${Date.now().toString(36).slice(-4)}`,
      genre: genre.key,
      title: t,
      artist: artist.trim() || "Original",
      year: year ? Number(year) : undefined,
      rank: null,
      styles,
      custom: true,
    };
    setCustom(editing ? custom.map((c) => (c.id === song.id ? song : c)) : [...custom, song]);
    setRep((prev) => ({ ...prev, [song.id]: { ...(prev[song.id] ?? {}), status } }));
    toast(editing ? "Saved" : `Added “${t}”`);
    onClose();
  };

  return (
    <>
      <SheetHeader onClose={onClose}>
        <p className="label">{editing ? "Your " + genre.noun : "Originals, or anything not in the book"}</p>
        <h2 className="mt-3 font-serif text-[40px] leading-none text-ink">{editing ? `Edit ${genre.noun}` : `Add a ${genre.noun}`}</h2>
      </SheetHeader>
      <form onSubmit={save} className="relative flex flex-1 flex-col gap-5 overflow-y-auto px-7 pb-7">
        <Field label="Title">
          <Input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${genre.noun === "tune" ? "Tune" : "Song"} title`} />
        </Field>
        {dupe && (
          <p className="flex gap-2.5 rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-sm text-ink-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-neon-hot" strokeWidth={1.75} /><span>
            “{dupe.title}” is already in the book{dupe.artist ? ` (${dupe.artist})` : ""}. You can still add yours if it&apos;s a different song.</span>
          </p>
        )}
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label={genre.key === "jazz" ? "Composer / artist" : "Artist"}>
            <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Leave blank for Original" />
          </Field>
          <Field label="Year">
            <Input type="number" min={1500} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
        </div>
        <Field label="How well do you know it?">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="know">Know it</option>
            <option value="shaky">Shaky (need a chart)</option>
            <option value="learn">Want to learn</option>
          </Select>
        </Field>
        <div>
          <span className="mb-2 block text-[13px] text-ink-2">Styles it fits</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(genre.styles).map(([code, label]) => {
              const on = styles.includes(code);
              return (
                <button key={code} type="button" aria-pressed={on} onClick={() => setStyles(on ? styles.filter((s) => s !== code) : [...styles, code])}
                  className={cx("h-7 rounded-full border px-3 text-xs transition-colors", on ? "border-[rgb(255_43_69/0.55)] bg-[rgb(255_43_69/0.1)] text-ink" : "border-line-strong text-muted hover:text-ink")}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-auto flex gap-2 pt-4">
          <Button type="submit" variant="primary">{editing ? <><Check strokeWidth={2} />Save changes</> : <><Plus strokeWidth={2} />Add to my {genre.noun}s</>}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </>
  );
}
