"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Book, GenreConfig, GigRequest, Repertoire, Setting, Song } from "@/lib/types";
import { SETTINGS } from "@/lib/types";
import { SongOption, searchByStatus } from "@/components/setlist/parts";
import { Field, Input, Select, Toggle } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { cx } from "@/components/ui/cx";

const num = (v: string) => (v === "" ? undefined : Number(v));

export function GigForm({ req, onChange, genre, books, songs, rep }: { req: GigRequest; onChange: (r: GigRequest) => void; genre: GenreConfig; books: Book[]; songs: Song[]; rep: Repertoire }) {
  const set = <K extends keyof GigRequest>(k: K, v: GigRequest[K]) => onChange({ ...req, [k]: v });
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[13px] text-ink-2">
          Styles <span className="text-faint">· none means anything you know</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(genre.styles).map(([code, label]) => {
            const on = req.styles.includes(code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={on}
                onClick={() => set("styles", on ? req.styles.filter((s) => s !== code) : [...req.styles, code])}
                className={cx(
                  "h-8 rounded-full border px-3 text-[13px] transition-colors",
                  on ? "border-[rgb(255_43_69/0.6)] bg-[rgb(255_43_69/0.1)] text-ink shadow-[0_0_16px_-6px_var(--neon-glow)]" : "border-line-strong text-ink-2 hover:border-[rgb(255_236_228/0.22)] hover:text-ink",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <LengthFields req={req} onChange={onChange} genre={genre} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Field label="Setting">
          <Select value={req.setting} onChange={(e) => set("setting", e.target.value as Setting)}>
            {SETTINGS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label={`Only ${genre.noun}s from`}>
          <Select value={req.bookId ?? ""} onChange={(e) => set("bookId", e.target.value || undefined)}>
            <option value="">Everything I know</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={req.date ?? ""} onChange={(e) => set("date", e.target.value || undefined)} className="tabular font-mono" />
        </Field>
        <Field label="Venue">
          <Input value={req.venue ?? ""} placeholder="The Blue Lantern" onChange={(e) => set("venue", e.target.value || undefined)} />
        </Field>
      </div>

      <LeaveOut req={req} onChange={onChange} genre={genre} songs={songs} rep={rep} />

      <div className="flex flex-col gap-4 border-t border-line pt-5">
        <Toggle checked={req.allowShaky} onChange={(v) => set("allowShaky", v)} label={`Allow Shaky ${genre.noun}s`} hint="Only when there aren't enough you know solidly" />
        <Toggle checked={!!req.favourites} onChange={(v) => set("favourites", v)} label="Crowd favourites first" hint={`Rank the best-known ${genre.noun}s higher`} />
      </div>
    </div>
  );
}

/** Time or song count. Shared by the full form and Pick mode, where every field is optional. */
export function LengthFields({ req, onChange, genre, optional }: { req: GigRequest; onChange: (r: GigRequest) => void; genre: GenreConfig; optional?: boolean }) {
  const set = <K extends keyof GigRequest>(k: K, v: GigRequest[K]) => onChange({ ...req, [k]: v });
  const useCount = req.count != null;
  const auto = optional ? "–" : "Auto";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-ink-2">
          Length{optional && <span className="text-faint"> · optional</span>}
        </span>
        <Segmented
          size="sm"
          label="Length by"
          value={useCount ? "count" : "time"}
          onChange={(v) => onChange(v === "count" ? { ...req, count: req.count ?? 10 } : { ...req, count: undefined })}
          options={[{ value: "time", label: "By time" }, { value: "count", label: `By ${genre.noun}s` }]}
        />
      </div>
      {useCount ? (
        <Field label={`How many ${genre.noun}s`} className="max-w-40">
          <Input type="number" inputMode="numeric" min={1} max={80} value={req.count ?? ""} onChange={(e) => set("count", num(e.target.value) ?? 1)} className="tabular font-mono" />
        </Field>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Hours">
            <Input type="number" inputMode="decimal" min={0} step={0.25} value={req.hours ?? ""} placeholder={optional ? "–" : "2"} onChange={(e) => set("hours", num(e.target.value))} className="tabular font-mono" />
          </Field>
          <Field label="Sets">
            <Input type="number" inputMode="numeric" min={1} max={6} value={req.sets ?? ""} placeholder={auto} onChange={(e) => set("sets", num(e.target.value))} className="tabular font-mono" />
          </Field>
          <Field label="Min / set">
            <Input type="number" inputMode="numeric" min={5} step={5} value={req.setMinutes ?? ""} placeholder={auto} onChange={(e) => set("setMinutes", num(e.target.value))} className="tabular font-mono" />
          </Field>
        </div>
      )}
    </div>
  );
}

/** Songs the player asked to leave out ("no Autumn Leaves"). */
function LeaveOut({ req, onChange, genre, songs, rep }: { req: GigRequest; onChange: (r: GigRequest) => void; genre: GenreConfig; songs: Song[]; rep: Repertoire }) {
  const [q, setQ] = useState("");
  const ex = useMemo(() => req.exclude ?? [], [req.exclude]);
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s] as const)), [songs]);
  const res = useMemo(() => searchByStatus(songs.filter((s) => !ex.includes(s.id)), q, rep, 5), [songs, ex, q, rep]);
  const add = (s: Song) => { onChange({ ...req, exclude: [...ex, s.id] }); setQ(""); };
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] text-ink-2">Leave out</span>
      {ex.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {ex.map((id) => (
            <li key={id} className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-surface-2/70 pr-1 pl-3 text-[13px] text-ink-2">
              <span className="max-w-[22ch] truncate">{byId.get(id)?.title ?? id}</span>
              <button type="button" aria-label={`Allow ${byId.get(id)?.title ?? id} again`} onClick={() => onChange({ ...req, exclude: ex.filter((x) => x !== id) })} className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-ink">
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && res[0]) { e.preventDefault(); add(res[0]); } }}
          placeholder={`A ${genre.noun} you don't want tonight`}
          aria-label={`Leave out a ${genre.noun}`}
        />
        {res.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line-strong bg-surface-2 py-1 shadow-[0_20px_60px_rgb(0_0_0/0.7)]">
            {res.map((s, i) => <li key={s.id}><SongOption song={s} status={rep[s.id]?.status} onPick={() => add(s)} active={i === 0} /></li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
