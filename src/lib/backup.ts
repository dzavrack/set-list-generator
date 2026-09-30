"use client";
// Backup / restore. Also reads backups exported by the old single-file app (version 2).
import { KEYS } from "./state";
import { allKeys, readKey, removeKey, writeKey } from "./storage";
import type { Book, GenreKey, Repertoire, Song } from "./types";
import { GENRE_ORDER } from "./types";

export function exportBackup() {
  const data: Record<string, unknown> = {};
  for (const k of allKeys()) data[k] = readKey(k, null);
  const blob = new Blob([JSON.stringify({ app: "gig-book", version: 3, exported: new Date().toISOString(), data }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gig-book-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

type OldCustom = { id: string; t: string; a?: string; y?: number; g?: string[]; genre?: GenreKey };
type OldList = { id: string; name: string; ids: string[]; genre?: GenreKey };

/** Returns a short description of what was restored. Throws on unreadable files. */
export async function importBackup(file: File): Promise<string> {
  const d = JSON.parse(await file.text());
  if (d?.app === "gig-book" && d.data) {
    for (const k of allKeys()) removeKey(k);
    for (const [k, v] of Object.entries(d.data)) writeKey(k, v);
    return "Backup restored";
  }
  if (d?.rep) {
    // Old app format
    const rep: Repertoire = {};
    for (const [id, e] of Object.entries(d.rep as Record<string, { status?: string; key?: string; feel?: string; notes?: string; styles?: string[] }>)) {
      rep[id] = { status: (e.status as Repertoire[string]["status"]) ?? null, key: e.key || undefined, feel: e.feel || undefined, notes: e.notes || undefined, styles: e.styles };
    }
    writeKey(KEYS.rep, rep);
    writeKey<Song[]>(
      KEYS.custom,
      ((d.custom ?? []) as OldCustom[]).map((c) => ({ id: c.id, genre: c.genre ?? "jazz", title: c.t, artist: c.a, year: c.y, rank: null, styles: c.g ?? [], custom: true })),
    );
    writeKey<Book[]>(KEYS.books, ((d.lists ?? []) as OldList[]).map((l) => ({ id: l.id, name: l.name, ids: l.ids, genre: l.genre ?? "jazz" })));
    const rb = (d.rulesByGenre ?? (d.rules ? { jazz: d.rules } : {})) as Record<string, object>;
    for (const g of GENRE_ORDER) if (rb[g]) writeKey(KEYS.rules(g), rb[g]);
    writeKey(KEYS.seeded, true);
    return `Imported ${Object.keys(rep).length} songs from the old app`;
  }
  throw new Error("Not a Gig Book backup");
}

/** Wipe everything this app stored in this browser. Keeps the "seeded" flag so the starter statuses don't come back. */
export function clearAll() {
  for (const k of allKeys()) removeKey(k);
  writeKey(KEYS.seeded, true);
}

/** Rough size of what's stored, in bytes (UTF-16 chars counted as 1). */
export function storedBytes(): number {
  let n = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("sl:")) n += k.length + (window.localStorage.getItem(k)?.length ?? 0);
    }
  } catch {}
  return n;
}
