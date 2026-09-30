"use client";
// App-wide persisted state. Keys are stable: backups and every screen depend on them.
import { usePersistent } from "./storage";
import type { Book, GenreKey, Repertoire, RepEntry, SetList, Song, Status } from "./types";

export const KEYS = {
  genre: "genre",
  rep: "rep",
  custom: "custom",
  setlists: "setlists",
  books: "books",
  rules: (g: GenreKey) => `rules:${g}`,
  practice: "practice",
  practiceLog: "practiceLog",
  seeded: "seeded",
  look: "look",
} as const;

/**
 * The app's overall look: "sleeve" (a 1950s-60s jazz record sleeve), "marquee" (neon signs,
 * after the Set List Generator) or "noir".
 */
export type Look = "sleeve" | "marquee" | "noir";
export const LOOKS: { value: Look; label: string }[] = [
  { value: "sleeve", label: "Sleeve" },
  { value: "marquee", label: "Marquee" },
  { value: "noir", label: "Noir" },
];
export const DEFAULT_LOOK: Look = "sleeve";

export function useLook() {
  return usePersistent<Look>(KEYS.look, DEFAULT_LOOK);
}

const EMPTY_REP: Repertoire = {};
const EMPTY_SONGS: Song[] = [];
const EMPTY_SETLISTS: SetList[] = [];
const EMPTY_BOOKS: Book[] = [];

export function useGenre() {
  return usePersistent<GenreKey>(KEYS.genre, "jazz");
}

export function useRepertoire() {
  const [rep, setRep] = usePersistent<Repertoire>(KEYS.rep, EMPTY_REP);

  /** Set a status; setting the current status again clears it. */
  const setStatus = (id: string, status: Status | null) =>
    setRep((prev) => {
      const cur: RepEntry = prev[id] ?? { status: null };
      const next = cur.status === status ? null : status;
      const entry = { ...cur, status: next };
      const out = { ...prev };
      if (!entry.status && !entry.key && !entry.feel && !entry.notes && !entry.styles) delete out[id];
      else out[id] = entry;
      return out;
    });

  const setStatusMany = (ids: string[], status: Status | null) =>
    setRep((prev) => {
      const out = { ...prev };
      for (const id of ids) out[id] = { ...(out[id] ?? {}), status };
      return out;
    });

  const setField = <K extends keyof RepEntry>(id: string, field: K, value: RepEntry[K]) =>
    setRep((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { status: null }), [field]: value } }));

  return { rep, setRep, setStatus, setStatusMany, setField };
}

export function useCustomSongs() {
  return usePersistent<Song[]>(KEYS.custom, EMPTY_SONGS);
}

export function useSetLists() {
  return usePersistent<SetList[]>(KEYS.setlists, EMPTY_SETLISTS);
}

export function useBooks() {
  return usePersistent<Book[]>(KEYS.books, EMPTY_BOOKS);
}
