// Small shared helpers for the set-list engine. Pure, no framework imports.
import type { GenreConfig, RepEntry, Song } from "../types";

/** Tempo "styles" shared by every non-jazz genre. In a request they lean the mix, they don't filter it. */
export const TEMPO_CODES = ["bl", "up", "pa"] as const;
export const TEMPO_LABELS: Record<string, string> = { bl: "Slow songs", up: "Up-tempo", pa: "Party & singalong" };

export const isJazz = (genre: GenreConfig): boolean => genre.key === "jazz";

export function isTempoCode(code: string, genre: GenreConfig): boolean {
  return !isJazz(genre) && (TEMPO_CODES as readonly string[]).includes(code);
}

/** Split request styles into real style filters and (non-jazz) tempo leanings. */
export function splitStyles(styles: string[], genre: GenreConfig): { styles: string[]; tempo: string[] } {
  const out: string[] = [];
  const tempo: string[] = [];
  for (const c of styles || []) {
    if (isTempoCode(c, genre)) {
      if (!tempo.includes(c)) tempo.push(c);
    } else if (!out.includes(c)) out.push(c);
  }
  return { styles: out, tempo };
}

/** The styles a song is played in: the user's override wins over the catalog tags. */
export function stylesOf(song: Song, entry?: RepEntry): string[] {
  return entry && Array.isArray(entry.styles) ? entry.styles : song.styles || [];
}

/** "1960", "pre" (before 1900) or "" when the year is unknown. */
export function decadeOf(song: Song): string {
  if (!song.year) return "";
  return song.year < 1900 ? "pre" : String(Math.floor(song.year / 10) * 10);
}

export function decadeLabel(d: string): string {
  if (d === "pre") return "Before 1900";
  return Number(d) >= 2000 ? d + "s" : "'" + d.slice(2) + "s";
}

/** Normalise a key name so "Bb major", "bb" and "B♭" compare equal. */
export function normKey(k: string | undefined): string {
  return String(k || "")
    .toLowerCase()
    .replace(/\s|maj(or)?/g, "")
    .replace("minor", "m")
    .replace("min", "m")
    .replace("♭", "b")
    .replace("♯", "#");
}

/** Title comparison key (ignores case, accents and punctuation). */
export function normTitle(s: string | undefined): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

export function nouns(genre: GenreConfig) {
  const one = genre.noun;
  return { one, many: one + "s", One: one[0].toUpperCase() + one.slice(1), Many: one[0].toUpperCase() + one.slice(1) + "s" };
}

export const plural = (n: number, word: string, many = word + "s") => `${n} ${n === 1 ? word : many}`;

export const round2 = (n: number) => Math.round(n * 100) / 100;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse yyyy-mm-dd as a UTC calendar date (no timezone drift). */
export function isoToUtc(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
export function utcToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function weekdayName(iso: string): string {
  const d = isoToUtc(iso);
  return d ? DAY_NAMES[d.getUTCDay()] : "";
}
/** "Fri, Oct 2" */
export function shortDate(iso: string): string {
  const d = isoToUtc(iso);
  if (!d) return iso;
  return `${DAY_NAMES[d.getUTCDay()].slice(0, 3)}, ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
