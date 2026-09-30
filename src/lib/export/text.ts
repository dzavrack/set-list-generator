// Plain-text exports of a set list. Pure functions, no DOM: safe to use anywhere and easy to test.
import type { GigSet, ItemFlag, SetItem, SetList, Song } from "../types";

export type TextFormat = "stage" | "bandleader" | "titles" | "numbered" | "markdown";

export interface TextFormatInfo {
  value: TextFormat;
  label: string;
  description: string;
}

export const TEXT_FORMATS: TextFormatInfo[] = [
  { value: "stage", label: "Stage", description: "Big, simple titles per set. Nothing to squint at." },
  { value: "bandleader", label: "Bandleader", description: "Keys, feels, minutes and flags, with running times per set." },
  { value: "titles", label: "Titles only", description: "One title per line. Paste straight into a text to the band." },
  { value: "numbered", label: "Numbered", description: "Numbered straight through every set, for calling tunes by number." },
  { value: "markdown", label: "Markdown", description: "Headed and formatted for notes apps, docs and chat." },
];

export interface TextOptions {
  /** Append the backup songs. Default true. */
  includeBackups?: boolean;
  /** Append the builder notes and per-song notes. Default false. */
  includeNotes?: boolean;
  /** Catalog lookup for composer credits (markdown / bandleader). */
  songs?: Map<string, Song>;
}

// ---------------------------------------------------------------------------
// Shared helpers (also used by the PDF export)

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse "yyyy-mm-dd" as a local calendar date (no timezone drift). */
export function parseIsoDate(iso?: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Saturday, October 3, 2026" (long) or "Sat, Oct 3, 2026" (short). Falls back to the raw string. */
export function formatGigDate(iso?: string, style: "long" | "short" = "long"): string {
  if (!iso) return "";
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const day = DAYS[d.getDay()];
  const month = MONTHS[d.getMonth()];
  return style === "long"
    ? `${day}, ${month} ${d.getDate()}, ${d.getFullYear()}`
    : `${day.slice(0, 3)}, ${month.slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

/** 45 -> "45 min", 135 -> "2h 15m", 120 -> "2h". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${String(r).padStart(2, "0")}m` : `${h}h`;
}

export function itemsMinutes(items: SetItem[]): number {
  return items.reduce((sum, it) => sum + (Number.isFinite(it.minutes) ? it.minutes : 0), 0);
}

export function setListTotals(sl: SetList): { sets: number; songs: number; minutes: number } {
  return {
    sets: sl.sets.length,
    songs: sl.sets.reduce((n, s) => n + s.items.length, 0),
    minutes: sl.sets.reduce((n, s) => n + itemsMinutes(s.items), 0),
  };
}

export const FLAG_LABELS: Record<ItemFlag, string> = {
  shaky: "shaky",
  "other-style": "off-style",
  picked: "request",
};

/** "Joseph Kosma, 1945" from the catalog, or "" when nothing is known. */
export function songCredit(item: SetItem, songs?: Map<string, Song>): string {
  const song = songs?.get(item.songId);
  const who = song?.composer || song?.artist || item.artist || "";
  const year = song?.publishYear ?? song?.year;
  return [who, year ? String(year) : ""].filter(Boolean).join(", ");
}

/** Lowercase-dash slug, ASCII only. */
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "2026-10-03-blue-note-set-list.pdf" */
export function exportFileName(sl: SetList, ext: string): string {
  const parts = [sl.date && parseIsoDate(sl.date) ? sl.date.slice(0, 10) : "", slugify(sl.venue || sl.name || "")]
    .filter(Boolean);
  parts.push("set-list");
  return `${parts.join("-")}.${ext}`;
}

// ---------------------------------------------------------------------------

function headerLines(sl: SetList): string[] {
  const lines: string[] = [];
  if (sl.name) lines.push(sl.name);
  const sub = [formatGigDate(sl.date), sl.venue].filter(Boolean).join(" · ");
  if (sub && sub !== sl.name) lines.push(sub);
  return lines;
}

function setHeading(set: GigSet, i: number): string {
  return set.name || `Set ${i + 1}`;
}

function flagText(item: SetItem): string {
  return (item.flags ?? []).map((f) => FLAG_LABELS[f] ?? f).join(", ");
}

function notesBlock(sl: SetList): string[] {
  const notes = sl.notes.filter((n) => n.trim());
  if (!notes.length) return [];
  return ["", "NOTES", ...notes.map((n) => `- ${n}`)];
}

function join(lines: string[]): string {
  // Collapse runs of blank lines and trim the ends.
  const out: string[] = [];
  for (const l of lines) {
    const line = l.replace(/\s+$/, "");
    if (line === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";
}

function formatStage(sl: SetList, o: Required<Omit<TextOptions, "songs">>): string {
  const lines: string[] = [];
  const head = [sl.name, formatGigDate(sl.date, "short"), sl.venue].filter(Boolean);
  if (head.length) lines.push(head.join(" — ").toUpperCase(), "");
  sl.sets.forEach((set, i) => {
    lines.push(`=== ${setHeading(set, i).toUpperCase()} ===`, "");
    for (const it of set.items) lines.push(it.title.toUpperCase());
    lines.push("", "");
  });
  if (o.includeBackups && sl.backups.length) {
    lines.push("=== BACKUPS ===", "");
    for (const it of sl.backups) lines.push(it.title.toUpperCase());
  }
  if (o.includeNotes) lines.push(...notesBlock(sl));
  return join(lines);
}

function formatBandleader(sl: SetList, o: Required<Omit<TextOptions, "songs">>, songs?: Map<string, Song>): string {
  const lines: string[] = [...headerLines(sl)];
  const all = [...sl.sets.flatMap((s) => s.items), ...(o.includeBackups ? sl.backups : [])];
  const titleW = Math.min(34, Math.max(12, ...all.map((it) => it.title.length)));
  const keyW = Math.max(3, ...all.map((it) => (it.key ?? "").length));
  const feelW = Math.max(4, ...all.map((it) => (it.feel ?? "").length));
  const numW = String(Math.max(1, setListTotals(sl).songs, sl.backups.length)).length;

  // Titles are never cut: a title longer than the column just pushes that row's columns over.
  const row = (it: SetItem, n: number | string, running?: number) => {
    const cols = [
      `${String(n).padStart(numW)}.`,
      it.title.padEnd(titleW),
      (it.key ?? "–").padEnd(keyW),
      (it.feel ?? "–").padEnd(feelW),
      `${String(Math.round(it.minutes)).padStart(2)}'`,
    ];
    if (running !== undefined) cols.push(`@${formatClock(running)}`);
    const flags = flagText(it);
    if (flags) cols.push(`[${flags}]`);
    let line = cols.join("  ");
    const credit = songCredit(it, songs);
    if (credit && songs) line += `  (${credit})`;
    const out = [line];
    if (o.includeNotes && it.note) out.push(`${" ".repeat(numW + 3)}↳ ${it.note}`);
    return out;
  };

  let total = 0;
  let n = 0; // numbered straight through the night, like the editor
  sl.sets.forEach((set, i) => {
    const mins = itemsMinutes(set.items);
    lines.push("", `${setHeading(set, i).toUpperCase()} · ${set.items.length} songs · ${formatDuration(mins)}`);
    let running = 0;
    set.items.forEach((it) => {
      n += 1;
      lines.push(...row(it, n, running));
      running += it.minutes;
    });
    total += mins;
  });
  const t = setListTotals(sl);
  lines.push("", `TOTAL: ${t.sets} ${t.sets === 1 ? "set" : "sets"} · ${t.songs} songs · ${formatDuration(total)} of music`);
  if (o.includeBackups && sl.backups.length) {
    lines.push("", `BACKUPS · ${sl.backups.length}`);
    sl.backups.forEach((it, j) => lines.push(...row(it, j + 1)));
  }
  if (o.includeNotes) lines.push(...notesBlock(sl));
  return join(lines);
}

/** Minutes into a set as an h:mm clock, e.g. 75 -> "1:15". */
function formatClock(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function formatTitles(sl: SetList, o: Required<Omit<TextOptions, "songs">>): string {
  const lines: string[] = [];
  sl.sets.forEach((set) => {
    lines.push(...set.items.map((it) => it.title), "");
  });
  if (o.includeBackups && sl.backups.length) lines.push("Backups:", ...sl.backups.map((it) => it.title));
  if (o.includeNotes) lines.push(...notesBlock(sl));
  return join(lines);
}

function formatNumbered(sl: SetList, o: Required<Omit<TextOptions, "songs">>): string {
  const lines: string[] = [...headerLines(sl)];
  const total = setListTotals(sl).songs;
  const w = String(Math.max(1, total)).length;
  let n = 0;
  sl.sets.forEach((set, i) => {
    lines.push("", setHeading(set, i));
    for (const it of set.items) {
      n += 1;
      lines.push(`${String(n).padStart(w)}. ${it.title}`);
      if (o.includeNotes && it.note) lines.push(`${" ".repeat(w + 2)}(${it.note})`);
    }
  });
  if (o.includeBackups && sl.backups.length) {
    lines.push("", "Backups");
    for (const it of sl.backups) lines.push(`${" ".repeat(w)}- ${it.title}`);
  }
  if (o.includeNotes) lines.push(...notesBlock(sl));
  return join(lines);
}

function mdEscape(s: string): string {
  return s.replace(/([\\`*_[\]#|<>])/g, "\\$1");
}

function formatMarkdown(sl: SetList, o: Required<Omit<TextOptions, "songs">>, songs?: Map<string, Song>): string {
  const lines: string[] = [];
  lines.push(`# ${mdEscape(sl.name || "Set list")}`);
  const sub = [formatGigDate(sl.date), sl.venue ? mdEscape(sl.venue) : ""].filter(Boolean).join(" · ");
  const t = setListTotals(sl);
  lines.push("", [sub ? `**${sub}**` : "", `${t.sets} ${t.sets === 1 ? "set" : "sets"} · ${t.songs} songs · ${formatDuration(t.minutes)}`].filter(Boolean).join("  \n"));

  const item = (it: SetItem, i: number, ordered: boolean) => {
    const meta = [it.key, it.feel, it.minutes ? `${Math.round(it.minutes)} min` : ""].filter(Boolean).join(" · ");
    const credit = songCredit(it, songs);
    const flags = flagText(it);
    let line = `${ordered ? `${i + 1}.` : "-"} **${mdEscape(it.title)}**`;
    if (credit && songs) line += ` _(${mdEscape(credit)})_`;
    if (meta) line += ` — ${meta}`;
    if (flags) line += ` \`${flags}\``;
    const out = [line];
    if (o.includeNotes && it.note) out.push(`   > ${mdEscape(it.note)}`);
    return out;
  };

  let n = 0; // continuous through the night; CommonMark keeps a list's starting number
  sl.sets.forEach((set, i) => {
    lines.push("", `## ${mdEscape(setHeading(set, i))} · ${formatDuration(itemsMinutes(set.items))}`, "");
    set.items.forEach((it) => lines.push(...item(it, n++, true)));
  });
  if (o.includeBackups && sl.backups.length) {
    lines.push("", "## Backups", "");
    sl.backups.forEach((it, j) => lines.push(...item(it, j, false)));
  }
  if (o.includeNotes) {
    const notes = sl.notes.filter((n) => n.trim());
    if (notes.length) lines.push("", "## Notes", "", ...notes.map((n) => `- ${mdEscape(n)}`));
  }
  return join(lines);
}

export function formatSetList(sl: SetList, format: TextFormat, opts: TextOptions = {}): string {
  const o = { includeBackups: opts.includeBackups ?? true, includeNotes: opts.includeNotes ?? false };
  switch (format) {
    case "stage":
      return formatStage(sl, o);
    case "bandleader":
      return formatBandleader(sl, o, opts.songs);
    case "titles":
      return formatTitles(sl, o);
    case "numbered":
      return formatNumbered(sl, o);
    case "markdown":
      return formatMarkdown(sl, o, opts.songs);
    default: {
      const never: never = format;
      throw new Error(`Unknown text format: ${String(never)}`);
    }
  }
}
