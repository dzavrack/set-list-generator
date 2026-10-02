// Natural-language gig description -> GigRequest, and back to a short summary.
import type { Book, GenreConfig, GigRequest, Rules, Setting, Song } from "../types";
import { SETTINGS } from "../types";
import { defaultRules } from "./rules";
import { planShape } from "./shape";
import {
  decadeLabel, isJazz, isoToUtc, longDate, nouns, normTitle, shortDate, splitStyles, TEMPO_LABELS, utcToIso,
} from "./util";

/** The engine accepts a few extra request fields that aren't (yet) in the shared type. */
export interface EngineGigRequest extends GigRequest {
  /** Song ids (or titles) to leave out ("no Autumn Leaves"). */
  exclude?: string[];
}

export interface ParseOptions {
  /** "Today" for relative dates (yyyy-mm-dd or Date). Defaults to the real current date. */
  today?: string | Date;
  /** Saved books: a book named in the text restricts the gig to it. */
  books?: Book[];
  /** Songs of this genre, so "no <title>" can exclude a song. */
  songs?: Song[];
}

const NUMW: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, a: 1, an: 1,
};
const num = (s: string): number => (NUMW[s.toLowerCase()] !== undefined ? NUMW[s.toLowerCase()] : parseFloat(s));

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

function todayUtc(today?: string | Date): Date {
  if (typeof today === "string") {
    const d = isoToUtc(today.slice(0, 10));
    if (d) return d;
  }
  const t = today instanceof Date ? today : new Date();
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Resolve a date mentioned in lower-cased text, relative to `today`. Returns "" when none. */
export function parseDate(s: string, today?: string | Date): string {
  const t0 = todayUtc(today);
  let m: RegExpMatchArray | null;
  if ((m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) {
    const d = isoToUtc(`${m[1]}-${m[2]}-${m[3]}`);
    if (d && !isNaN(d.getTime())) return utcToIso(d);
  }
  let month = -1, day = 0;
  if ((m = s.match(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
    month = MONTHS.indexOf(m[1].slice(0, 3)); day = +m[2];
  } else if ((m = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`)))) {
    month = MONTHS.indexOf(m[2].slice(0, 3)); day = +m[1];
  }
  if (month >= 0 && day >= 1 && day <= 31) {
    let y = t0.getUTCFullYear();
    let d = new Date(Date.UTC(y, month, day));
    if (d < t0) d = new Date(Date.UTC(++y, month, day));
    return utcToIso(d);
  }
  if ((m = s.match(/\b(?:(next|this|coming)\s+)?(today|tonight|tonite|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    const w = m[2];
    if (w === "today" || w === "tonight" || w === "tonite") return utcToIso(t0);
    if (w === "tomorrow") return utcToIso(addDays(t0, 1));
    const i = DAYS.indexOf(w);
    let add = (i - t0.getUTCDay() + 7) % 7;
    // Fix: the old app jumped a week ahead when you named today's weekday ("Friday" said on a Friday).
    // A bare weekday now means the next one including today; "next Friday" on a Friday means in a week.
    if (add === 0 && m[1] === "next") add = 7;
    return utcToIso(addDays(t0, add));
  }
  return "";
}

const MONTH_NAMES = new RegExp(`^${MONTH_RE}$`, "i");
const VENUE_STOP =new Set([...DAYS.map((d) => d[0].toUpperCase() + d.slice(1)), "Christmas", "Xmas", "Easter", "Halloween", "Night", "Noon", "Midnight"]);

export function parseGigRequest(
  text: string,
  genre: GenreConfig,
  base?: Partial<GigRequest>,
  opts: ParseOptions = {},
): { request: GigRequest; summary: string } {
  const raw = String(text || "");
  let s = " " + raw.toLowerCase().replace(/[–—]/g, "-") + " ";
  const jazz = isJazz(genre);

  const req: EngineGigRequest = {
    styles: [],
    setting: "standard",
    allowShaky: true,
    ...(base || {}),
  };
  // Duration fields from the text replace the base ones as a whole, so start from nothing.
  const found: Partial<EngineGigRequest> = {};

  // A saved book named in the text ("from my trio book")
  const books = (opts.books || []).filter((b) => b.genre === genre.key).slice().sort((a, b) => b.name.length - a.name.length);
  for (const b of books) {
    const nm = b.name.toLowerCase().trim();
    if (nm && s.includes(nm)) {
      found.bookId = b.id;
      s = s.replace(nm, " ");
      break;
    }
  }

  // Styles (non-jazz tempo codes bl/up/pa are kept in styles; the builder treats them as leanings)
  const styles: string[] = [];
  for (const [src, code] of genre.words || []) {
    let re: RegExp;
    try { re = new RegExp(src, "i"); } catch { continue; }
    if (re.test(s) && !styles.includes(code)) styles.push(code);
  }
  // "hard bop" alone shouldn't also mean bebop
  if (jazz && styles.includes("hb") && styles.includes("bp") && !/\bbe-?bop\b|\bbop\b/.test(s.replace(/hard ?bop/g, ""))) {
    styles.splice(styles.indexOf("bp"), 1);
  }
  if (styles.length) found.styles = styles;

  // Decades (non-jazz: songs carry years)
  if (!jazz) {
    const decades: string[] = [];
    const add = (d: string) => { if (!decades.includes(d)) decades.push(d); };
    const DW: Record<string, string> = { fifties: "1950", sixties: "1960", seventies: "1970", eighties: "1980", nineties: "1990" };
    for (const [w, d] of Object.entries(DW)) if (s.includes(w)) add(d);
    const dre = /\b(19|20)?([0-9])0'?s\b/g;
    let dm: RegExpExecArray | null;
    while ((dm = dre.exec(s))) add(dm[1] ? dm[1] + dm[2] + "0" : +dm[2] >= 3 ? "19" + dm[2] + "0" : "20" + dm[2] + "0");
    if (/\boldies\b/.test(s)) { add("1950"); add("1960"); }
    if (/before 1900|19th century|old[- ]time hymns/.test(s)) add("pre");
    if (decades.length) found.decades = decades;
  }
  // Crowd favourites (now for every genre; jazz ranks by how often a tune is recorded)
  if (/most requested|crowd[- ]?(favou?rites|pleasers)|the hits|greatest hits|everybody knows|well[- ]known|popular/.test(s)) found.favourites = true;

  // Duration
  let m: RegExpMatchArray | null;
  let hours = 0, sets = 0, setMinutes = 0;
  if (/\bhalf(?:\s+an?)?\s*-?\s*hour\b/.test(s) && !/and a half/.test(s)) hours = 0.5;
  else if ((m = s.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|an?)\s*(and a half|½)?\s*-?\s*(?:hours?|hrs?)\b(\s+and a half)?/))) {
    hours = num(m[1]) + (m[2] || m[3] ? 0.5 : 0);
  }
  if (!hours && (m = s.match(/\b(\d+(?:\.\d+)?)\s*h\b/))) hours = num(m[1]);
  if ((m = s.match(/\b(\d+|one|two|three|four|five)\s*(?:x|×|\*)\s*(\d+)/))) {
    sets = num(m[1]); setMinutes = num(m[2]);
  } else {
    if ((m = s.match(/\b(\d+|one|two|three|four|five)\s+(?:\d+\s*-?\s*min(?:ute)?s?\s+)?sets?\b/))) sets = num(m[1]);
    if ((m = s.match(/(\d+)\s*-?\s*min(?:ute)?s?\s*sets?\b|sets?\s+of\s+(\d+)\s*(?:-?\s*min)?/))) {
      setMinutes = num(m[1] || m[2]);
      // "a 45 minute set" = one set (old app made it two 45-minute sets of a default 2-hour gig)
      if (!sets && !hours && /\bmin(?:ute)?s?\s*set\b(?!s)/.test(m[0])) sets = 1;
    } else if (!hours && (m = s.match(/\b(\d+)\s*-?\s*min(?:ute)?s?\b/))) hours = num(m[1]) / 60;
  }
  if (!hours && !sets && !setMinutes && /cocktail hour|happy hour/.test(s)) hours = 1;
  let count = 0;
  if ((m = s.match(/\b(\d+|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s+(?:tunes|songs)\b/))) count = num(m[1]);
  if (count) {
    found.count = count; found.hours = undefined; found.sets = undefined; found.setMinutes = undefined;
  } else if (hours || sets || setMinutes) {
    found.count = undefined;
    found.hours = hours || undefined;
    found.sets = sets || undefined;
    found.setMinutes = setMinutes || undefined;
  }

  // Setting (later matches win, as before)
  let setting: Setting | null = null;
  if (/restaurant|dinner|background|cocktail|wedding|brunch|reception|party|gala|lobby|winery|brewery/.test(s)) setting = "background";
  if (/listening|concert|club gig|jazz club|recital|showcase/.test(s)) setting = "listening";
  if (/\bjam\b|jam session/.test(s)) setting = "jam";
  if (/swing dance|dance|lindy/.test(s)) setting = "dance";
  if (!jazz && /party|dance ?floor|reception|club night|line dance/.test(s) && !/dinner|cocktail|background|restaurant|brunch/.test(s)) setting = "dance";
  if (setting) found.setting = setting;

  if (/no shaky|only (?:tunes|songs) i know|nothing shaky|solid only/.test(s)) found.allowShaky = false;

  const date = parseDate(s, opts.today);
  if (date) found.date = date;

  // Venue: "at The Blue Note" / "@ Joe's". Fix: old regex needed a word character before "@".
  const vre = /(?:\b[Aa]t\b|@)\s+(?:[Tt]he\s+)?([A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*){0,3})/g;
  let vm: RegExpExecArray | null;
  while ((vm = vre.exec(raw))) {
    const words: string[] = [];
    for (const w of vm[1].replace(/[.,]+$/, "").split(/\s+/)) {
      const bare = w.replace(/[.,'s]+$/, "");
      if (VENUE_STOP.has(bare) || VENUE_STOP.has(w) || MONTH_NAMES.test(bare)) break;
      words.push(w);
    }
    if (words.length) { found.venue = words.join(" ").replace(/[.,]+$/, ""); break; }
  }

  // "no Autumn Leaves" / "without Misty" (old app: first one only)
  if (opts.songs && opts.songs.length) {
    const ex: string[] = [];
    const xre = /(?:\bno|\bwithout|\bskip|\bexcept)\s+([a-z0-9' ]+?)(?=[,.;]|\s+and\s|\s*$)/g;
    let xm: RegExpExecArray | null;
    while ((xm = xre.exec(s))) {
      const key = normTitle(xm[1]);
      const song = key ? opts.songs.find((x) => x.genre === genre.key && normTitle(x.title) === key) : undefined;
      if (song && !ex.includes(song.id)) ex.push(song.id);
    }
    if (ex.length) found.exclude = ex;
  }

  for (const [k, v] of Object.entries(found)) {
    if (v === undefined) delete (req as unknown as Record<string, unknown>)[k];
    else (req as unknown as Record<string, unknown>)[k] = v;
  }
  return { request: req, summary: describeRequest(req, genre, undefined, opts.books) };
}

/** Short human summary, e.g. "2 sets × 55 min · Ballad + Songbook standards · Standard gig · Fri, Oct 2". */
export function describeRequest(req: GigRequest, genre: GenreConfig, rules?: Rules, books?: Book[]): string {
  const r = rules || defaultRules(genre);
  const { many } = nouns(genre);
  const parts: string[] = [];
  const picks = req.picks && req.picks.length ? req.picks : null;
  const shape = planShape(req, r);
  if (shape.count) parts.push(`${shape.count} ${many}`);
  else parts.push(`${shape.sets} set${shape.sets > 1 ? "s" : ""} × ${shape.minutesPerSet} min`);
  const { styles, tempo } = splitStyles(req.styles || [], genre);
  if (!picks) parts.push(styles.length ? styles.map((c) => genre.styles[c] || c).join(" + ") : "Any style");
  parts.push(SETTINGS.find((x) => x.value === req.setting)?.label || "Standard gig");
  if (picks) parts.push(`from ${picks.length} picked ${many}${req.keepOrder ? " (your order)" : ""}`);
  if (req.decades && req.decades.length) parts.push(req.decades.map(decadeLabel).join(" + "));
  if (tempo.length) parts.push("leaning " + tempo.map((c) => (genre.styles[c] || TEMPO_LABELS[c] || c).toLowerCase()).join(", "));
  if (req.favourites) parts.push("crowd favourites");
  if (req.bookId) {
    const b = (books || []).find((x) => x.id === req.bookId);
    parts.push(b ? `from “${b.name}”` : "from a saved book");
  }
  if (req.date) parts.push(shortDate(req.date));
  if (req.venue) parts.push("@ " + req.venue);
  if (!req.allowShaky) parts.push(`no shaky ${many}`);
  return parts.join(" · ");
}

/**
 * Default set-list name. Plain, never the styles. Always "Set List", unless the gig has both a
 * date and a venue: "Friday, Oct 2 · The Blue Note Set List".
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- genre kept so callers needn't change
export function autoName(req: GigRequest, genre?: GenreConfig): string {
  const venue = req.venue?.trim();
  if (!req.date || !venue) return "Set List";
  return `${longDate(req.date)} · ${venue} Set List`;
}
