"use client";
import { useState } from "react";
import { ArrowLeft, Check, FileText, Search } from "lucide-react";
import type { GenreConfig, Song, Status } from "@/lib/types";
import { matchPastedList } from "@/lib/catalog";
import { useBooks, useCustomSongs, useRepertoire } from "@/lib/state";
import { uid } from "@/lib/storage";
import { Sheet, SheetHeader } from "@/components/ui/Sheet";
import { Field, Input, Select, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/Toast";

type Match = ReturnType<typeof matchPastedList>[number];

export function ImportSheet({ open, onClose, genre, songs }: { open: boolean; onClose: () => void; genre: GenreConfig; songs: Song[] }) {
  const [text, setText] = useState("");
  const [status, setStatusVal] = useState<Status | "">("know");
  const [name, setName] = useState("");
  const [result, setResult] = useState<Match[] | null>(null);
  const [choice, setChoice] = useState<Record<number, string>>({}); // row -> song id or "new" or ""
  const { setRep } = useRepertoire();
  const [custom, setCustom] = useCustomSongs();
  const [books, setBooks] = useBooks();

  const run = () => {
    const r = matchPastedList(text, songs);
    setResult(r);
    setChoice(Object.fromEntries(r.map((m, i) => [i, m.song ? m.song.id : m.candidates[0] ? "" : "new"])));
  };

  const apply = () => {
    if (!result) return;
    const ids: string[] = [];
    const added: Song[] = [];
    result.forEach((m, i) => {
      const c = choice[i];
      if (!c) return;
      if (c === "new") {
        const id = `my-${genre.key}-${m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${i.toString(36)}${Date.now().toString(36).slice(-3)}`;
        added.push({ id, genre: genre.key, title: m.title, artist: "Original", rank: null, styles: [], custom: true });
        ids.push(id);
      } else ids.push(c);
    });
    if (added.length) setCustom([...custom, ...added]);
    setRep((prev) => {
      const out = { ...prev };
      result.forEach((m, i) => {
        const id = choice[i] === "new" ? added.find((a) => a.title === m.title)?.id : choice[i];
        if (!id) return;
        out[id] = { ...(out[id] ?? { status: null }), ...(status ? { status } : {}), ...(m.key ? { key: m.key } : {}) };
      });
      return out;
    });
    if (name.trim()) setBooks([...books, { id: uid("b-"), genre: genre.key, name: name.trim(), ids }]);
    toast(`Imported ${ids.length} ${genre.noun}s${name.trim() ? ` into “${name.trim()}”` : ""}`);
    setResult(null);
    setText("");
    setName("");
    onClose();
  };

  const found = result?.filter((_, i) => choice[i] && choice[i] !== "new").length ?? 0;
  const newCount = result?.filter((_, i) => choice[i] === "new").length ?? 0;

  return (
    <Sheet open={open} onClose={onClose} title="Import a set list">
      <SheetHeader onClose={onClose}>
        <p className="label">Paste from anywhere</p>
        <h2 className="mt-3 font-serif text-[40px] leading-none text-ink">Import a list</h2>
        <p className="mt-3 text-sm text-ink-2">One {genre.noun} per line, or separated by commas. Keys in brackets like “(Gm)” are kept.</p>
      </SheetHeader>
      <div className="relative flex flex-1 flex-col gap-5 overflow-y-auto px-7 pb-7">
        {!result ? (
          <>
            <textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={cx(inputClass, "h-auto py-3 font-mono text-[13px] leading-relaxed")}
              placeholder={"All of Me\nAutumn Leaves (Gm)\n1. Minor Swing\nTake the A Train - Ellington"}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={run} disabled={!text.trim()}><Search strokeWidth={2} />Find these {genre.noun}s</Button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] px-3 text-sm text-ink-2 hover:bg-[rgb(255_236_228/0.06)] hover:text-ink">
                <FileText className="h-4 w-4" strokeWidth={1.75} />Open a text file
                <input type="file" accept=".txt,.csv,.tsv,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
              </label>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              Found <b className="font-medium text-ink">{found}</b> in the book{newCount ? <>, and <b className="font-medium text-ink">{newCount}</b> will be added as your own</> : null}.
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {result.map((m, i) => (
                <li key={i} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={m.line}>{m.line}</span>
                  <Select value={choice[i] ?? ""} onChange={(e) => setChoice({ ...choice, [i]: e.target.value })} className="sm:w-64">
                    {m.song && <option value={m.song.id}>✓ {m.song.title}</option>}
                    {m.candidates.filter((c) => c.id !== m.song?.id).map((c) => <option key={c.id} value={c.id}>{c.title}{c.artist ? ` — ${c.artist}` : ""}</option>)}
                    <option value="new">+ Add “{m.title}” as my own</option>
                    <option value="">Ignore this line</option>
                  </Select>
                </li>
              ))}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mark them as">
                <Select value={status} onChange={(e) => setStatusVal(e.target.value as Status | "")}>
                  <option value="know">Know it</option>
                  <option value="shaky">Shaky</option>
                  <option value="learn">Want to learn</option>
                  <option value="">Don&apos;t change status</option>
                </Select>
              </Field>
              <Field label="Save as a list (optional)">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trio book" />
              </Field>
            </div>
            <div className="mt-auto flex gap-2 pt-2">
              <Button variant="primary" onClick={apply} disabled={!found && !newCount}><Check strokeWidth={2} />Import {found + newCount}</Button>
              <Button variant="ghost" onClick={() => setResult(null)}><ArrowLeft strokeWidth={1.75} />Back</Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
