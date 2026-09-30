"use client";

// Song catalog: lazy per-genre loading, search, and set-list paste matching.
// Ported from the old single-file app (searchSongs, splitInput/cleanLine, matchTitle/matchTitleLoose).

import { useEffect, useMemo, useState } from "react";
import type { GenreKey, Song } from "./types";

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const cache = new Map<GenreKey, Song[]>();
const pending = new Map<GenreKey, Promise<Song[]>>();

// A static switch so the bundler emits one chunk per genre.
function importGenre(genre: GenreKey): Promise<{ default: unknown }> {
  switch (genre) {
    case "jazz": return import("@/data/genres/jazz.json");
    case "blues": return import("@/data/genres/blues.json");
    case "country": return import("@/data/genres/country.json");
    case "rock": return import("@/data/genres/rock.json");
    case "pop": return import("@/data/genres/pop.json");
    case "rnb": return import("@/data/genres/rnb.json");
    case "folk": return import("@/data/genres/folk.json");
    case "gospel": return import("@/data/genres/gospel.json");
    case "latin": return import("@/data/genres/latin.json");
    case "reggae": return import("@/data/genres/reggae.json");
    case "hiphop": return import("@/data/genres/hiphop.json");
    case "wedding": return import("@/data/genres/wedding.json");
    default: {
      const never: never = genre;
      return Promise.reject(new Error(`Unknown genre: ${String(never)}`));
    }
  }
}

/** Load a genre's catalog (cached; one network chunk per genre). */
export function loadSongs(genre: GenreKey): Promise<Song[]> {
  const hit = cache.get(genre);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(genre);
  if (!p) {
    p = importGenre(genre)
      .then((m) => {
        const songs = m.default as Song[];
        cache.set(genre, songs);
        pending.delete(genre);
        return songs;
      })
      .catch((e) => {
        pending.delete(genre);
        throw e;
      });
    pending.set(genre, p);
  }
  return p;
}

/** The genre's catalog if it has already been loaded, else undefined. */
export function getLoadedSongs(genre: GenreKey): Song[] | undefined {
  return cache.get(genre);
}

/**
 * Catalog for a genre plus the user's custom songs of that genre.
 * `custom` should be referentially stable (e.g. from state) to avoid needless re-merging.
 */
export function useSongs(
  genre: GenreKey,
  custom?: Song[],
): { songs: Song[]; loading: boolean; byId: Map<string, Song> } {
  const [loaded, setLoaded] = useState<{ genre: GenreKey; songs: Song[] } | null>(() => {
    const s = cache.get(genre);
    return s ? { genre, songs: s } : null;
  });

  useEffect(() => {
    let alive = true;
    loadSongs(genre).then(
      (songs) => { if (alive) setLoaded({ genre, songs }); },
      (e) => { console.error("Failed to load catalog", genre, e); },
    );
    return () => { alive = false; };
  }, [genre]);

  const base = loaded && loaded.genre === genre ? loaded.songs : cache.get(genre);

  const songs = useMemo(() => {
    const mine = (custom ?? [])
      .filter((s) => s.genre === genre)
      .map((s) => (s.custom ? s : { ...s, custom: true }));
    if (!base) return mine;
    return mine.length ? base.concat(mine) : base;
  }, [base, custom, genre]);

  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  return { songs, loading: !base, byId };
}

// ---------------------------------------------------------------------------
// Normalising
// ---------------------------------------------------------------------------

function stripAccents(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/**
 * Normalise a title for comparison: lowercase, accents removed, "&" -> "and",
 * leading "the/a/an" dropped, punctuation removed, whitespace collapsed.
 * Words stay separated by single spaces ("The Girl from Ipanema" -> "girl from ipanema").
 */
export function normalizeTitle(s: string): string {
  return stripAccents(String(s ?? "").toLowerCase())
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "");
}

/** Old app's normT: lowercase, accents removed, everything but a-z0-9 dropped. */
function compact(s: string): string {
  return stripAccents(String(s ?? "").toLowerCase()).replace(/[^a-z0-9]/g, "");
}

/** Compact form ignoring a leading article and any parenthetical. */
function bare(s: string): string {
  return normalizeTitle(String(s ?? "").replace(/\(.*?\)/g, "")).replace(/ /g, "");
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Title/artist search. Scoring: exact title 100 > starts-with 60 > contains 40 > artist match 25,
 * plus a small boost for hits and popular (low-rank) songs. Queries under 2 chars return [].
 */
export function searchSongs(songs: Song[], query: string, limit = 8): Song[] {
  const q = stripAccents(query.trim().toLowerCase());
  if (q.length < 2) return [];
  const nq = compact(q);
  const bq = bare(q);
  const res: [number, Song][] = [];
  for (const t of songs) {
    const tt = stripAccents(t.title.toLowerCase());
    const aa = stripAccents((t.artist ?? "").toLowerCase());
    const nt = compact(t.title);
    let s: number;
    if (nt === nq || (bq && bare(t.title) === bq)) s = 100;
    else if (tt.startsWith(q) || (nq && nt.startsWith(nq)) || (bq.length >= 3 && bare(t.title).startsWith(bq))) s = 60;
    else if (tt.includes(q) || (nq.length >= 3 && nt.includes(nq))) s = 40;
    else if (aa.includes(q)) s = 25;
    else continue;
    if (t.hit) s += 3;
    if (t.rank) s += Math.max(0, 3 - t.rank / 400);
    res.push([s, t]);
  }
  return res
    .sort((a, b) => b[0] - a[0] || (a[1].rank ?? 1e9) - (b[1].rank ?? 1e9) || a[1].title.localeCompare(b[1].title))
    .slice(0, limit)
    .map((x) => x[1]);
}

// ---------------------------------------------------------------------------
// Paste matching ("Import your own set list")
// ---------------------------------------------------------------------------

export interface PasteMatch {
  /** The raw input line (or CSV/TSV first column). */
  line: string;
  /** Cleaned title: numbering, bullets, quotes and key markings removed. */
  title: string;
  /** Key found on the line, normalised like "Bb", "F#m". */
  key?: string;
  /** Best match, if confident. */
  song?: Song;
  /** How the match was made. */
  match?: "exact" | "close";
  /** Other plausible songs, best first, up to 5. Empty for exact matches; excludes `song`. */
  candidates: Song[];
}

const KEY_SUFFIX = "(m(?:in(?:or)?)?|M(?:in(?:or)?)?|maj(?:or)?|Maj(?:or)?)?";
const KEY_PAREN = new RegExp(`[(\\[]\\s*(?:in\\s+)?([A-G])\\s*([b#♭♯]?)\\s*${KEY_SUFFIX}\\s*[)\\]]`);
const KEY_TRAIL = new RegExp(`\\s+[-–—|:]\\s+(?:in\\s+)?([A-G])([b#♭♯]?)${KEY_SUFFIX}\\s*$`);
const KEY_PREFIX = new RegExp(`^(?:in\\s+)?([A-G])([b#♭♯]?)${KEY_SUFFIX}\\s*[-–—|:]\\s+`);

function formatKey(note: string, acc: string, suffix?: string): string {
  const a = acc === "♭" ? "b" : acc === "♯" ? "#" : acc;
  const minor = !!suffix && /^m/i.test(suffix) && !/^maj/i.test(suffix);
  return note.toUpperCase() + a + (minor ? "m" : "");
}

/** Split a line's title from any key marking, and strip numbering/bullets/quotes. */
function cleanLine(raw: string): { title: string; key?: string } {
  let l = raw.trim();
  let key: string | undefined;
  // "1.", "2)", "3:", "4 -", bullets
  l = l.replace(/^\s*(?:\d{1,3}\s*[).:\-–]|[-*•·]+|#\d{1,3})\s*/, "");
  let m = l.match(KEY_PAREN);
  if (m) { key = formatKey(m[1], m[2], m[3]); l = l.replace(m[0], " "); }
  if (!key && (m = l.match(KEY_TRAIL))) { key = formatKey(m[1], m[2], m[3]); l = l.slice(0, m.index); }
  if (!key && (m = l.match(KEY_PREFIX))) { key = formatKey(m[1], m[2], m[3]); l = l.slice(m[0].length); }
  l = l.replace(/^["'“‘]+|["'”’]+$/g, "").replace(/\s{2,}/g, " ").trim();
  return { title: l, key };
}

/** Split pasted text into lines, handling CSV/TSV exports and comma/semicolon-separated lists. */
function splitInput(text: string): string[] {
  const raw = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let header = "";
  if (raw.length && /^"?(titles?|songs?|tunes?|names?|song title|tune title)"?\s*([,\t]|$)/i.test(raw[0])) header = raw.shift()!;
  // Spreadsheet export: most lines have tabs -> first column.
  const tabbed = raw.filter((l) => l.includes("\t")).length;
  if ((raw.length >= 3 && tabbed >= raw.length * 0.6) || header.includes("\t")) return raw.map((l) => l.split("\t")[0].trim()).filter(Boolean);
  // CSV: most lines share the same comma count -> first column.
  const commas = raw.map((l) => (l.match(/,/g) || []).length);
  const same = commas.filter((c) => c > 0 && c === commas[0]).length;
  if ((raw.length >= 3 && commas[0] > 0 && same >= raw.length * 0.8) || header.includes(",")) {
    return raw.map((l) => { const m = l.match(/^"([^"]*)"/); return (m ? m[1] : l.split(",")[0]).trim(); }).filter(Boolean);
  }
  // Otherwise lines, and commas/semicolons within a line (not inside parentheses).
  return raw.flatMap((l) => l.split(/;|,(?![^(]*\))/)).map((l) => l.trim()).filter(Boolean);
}

const STOP = new Set(["the", "a", "an", "of", "in", "to", "and", "my", "you", "i"]);
function words(s: string): Set<string> {
  return new Set(normalizeTitle(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w)));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((w) => { if (b.has(w)) inter++; });
  return inter / (a.size + b.size - inter);
}

interface Indexed { song: Song; c: string; b: string; w: Set<string> }

function matchTitle(text: string, idx: Indexed[]): { song: Song; how: "exact" | "close" } | null {
  const n = compact(text);
  if (n.length < 2) return null;
  const bt = bare(text);
  const exact = idx.find((x) => x.c === n) || (bt ? idx.find((x) => x.b === bt) : undefined);
  if (exact) return { song: exact.song, how: "exact" };
  if (n.length >= 5) {
    const c = idx.filter((x) => x.c.startsWith(n) || (bt.length >= 5 && x.b.startsWith(bt)));
    if (c.length === 1) return { song: c[0].song, how: "close" };
  }
  const W = words(text);
  if (!W.size) return null;
  let best: Indexed | null = null;
  let bs = 0;
  for (const x of idx) {
    const sc = jaccard(W, x.w);
    if (sc > bs || (sc === bs && best && (x.song.rank ?? 1e9) < (best.song.rank ?? 1e9))) { bs = sc; best = x; }
  }
  return best && bs >= 0.6 ? { song: best.song, how: "close" } : null;
}

/** Title variants to try: the whole line, then "Title - Artist", "Title by Artist", "Title (note)", "12 Title". */
function variants(title: string): { text: string; artist?: string }[] {
  const out: { text: string; artist?: string }[] = [{ text: title }];
  const dash = title.split(/\s+[-–—|]\s+/);
  if (dash.length > 1) out.push({ text: dash[0], artist: dash.slice(1).join(" ") });
  const by = title.split(/\s+by\s+/i);
  if (by.length > 1) out.push({ text: by[0], artist: by.slice(1).join(" ") });
  const noParen = title.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  if (noParen !== title) out.push({ text: noParen });
  const noNum = title.replace(/^\d{1,3}\s+(?=\D)/, "");
  if (noNum !== title) out.push({ text: noNum });
  return out.filter((v) => v.text.trim());
}

/**
 * Match a pasted set list (one title per line, or CSV/TSV, or comma-separated) against the catalog.
 * Handles numbering ("1.", "2)"), bullets, quotes, keys ("(Gm)", "(in Bb)", "- F#m"),
 * "Title - Artist" and "Title by Artist". Repeated matches of the same song are dropped.
 */
export function matchPastedList(text: string, songs: Song[]): PasteMatch[] {
  const idx: Indexed[] = songs.map((song) => ({ song, c: compact(song.title), b: bare(song.title), w: words(song.title) }));
  const seen = new Set<string>();
  const out: PasteMatch[] = [];

  for (const line of splitInput(text)) {
    const { title, key } = cleanLine(line);
    if (!title) continue;

    let song: Song | undefined;
    let how: "exact" | "close" | undefined;
    const vs = variants(title);
    for (let i = 0; i < vs.length; i++) {
      const m = matchTitle(vs[i].text, idx);
      if (!m) continue;
      // If an artist was given and another song with the same title matches it, prefer that one.
      const artist = vs[i].artist ? normalizeTitle(vs[i].artist!) : "";
      if (artist) {
        const same = idx.filter((x) => x.b === bare(m.song.title) && normalizeTitle(x.song.artist ?? "").includes(artist));
        if (same.length) { song = same[0].song; how = m.how; break; }
      }
      song = m.song;
      how = i === 0 ? m.how : "close";
      break;
    }

    if (song && seen.has(song.id)) continue;
    if (song) seen.add(song.id);

    // Candidates: search hits on each variant, then fuzzy word matches.
    const cand = new Map<string, Song>();
    for (const v of vs) for (const s of searchSongs(songs, v.text, 5)) cand.set(s.id, s);
    const W = words(vs.find((v) => v.artist)?.text ?? title);
    if (W.size) {
      idx
        .map((x) => [jaccard(W, x.w), x.song] as const)
        .filter(([sc]) => sc >= 0.3)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 5)
        .forEach(([, s]) => cand.set(s.id, s));
    }
    if (song) cand.delete(song.id);
    if (how === "exact") cand.clear();

    out.push({ line, title, ...(key ? { key } : {}), ...(song ? { song, match: how } : {}), candidates: [...cand.values()].slice(0, 5) });
  }
  return out;
}
