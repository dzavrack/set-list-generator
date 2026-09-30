// Small fixtures for the engine tests (not used by the app).
import type { GenreConfig, Repertoire, Song, Status } from "../types";

export const JAZZ: GenreConfig = {
  key: "jazz", name: "Jazz", sign: "Jazz Gig Book", noun: "tune", tagline: "",
  styles: { gy: "Gypsy jazz", tr: "Trad / New Orleans", sw: "Swing era", sb: "Songbook standards", bp: "Bebop", hb: "Hard bop", md: "Modal / post-bop", la: "Bossa / Latin", bl: "Ballad", bu: "Blues", wz: "Waltz", po: "Pop / soul", xm: "Holiday" },
  neighbors: { gy: ["sw", "tr"], tr: ["sw", "gy"], sw: ["tr", "gy", "sb"], sb: ["sw", "bl"], bp: ["hb", "sw"], hb: ["bp", "md"], md: ["hb"], la: ["sb"], bl: ["sb"], bu: ["hb", "sw", "bp"], wz: ["sb", "bl"], po: ["sb"], xm: ["sb"] },
  words: [
    ["gyps(y|ies)|manouche|django|hot club", "gy"],
    ["\\btrad\\b|dixieland|new orleans|dixie", "tr"],
    ["\\bswing\\b(?! dance)|big band", "sw"],
    ["songbook|standards?\\b|great american", "sb"],
    ["\\bbe-?bop\\b|\\bbop\\b", "bp"],
    ["hard ?bop|soul jazz|straight[- ]ahead", "hb"],
    ["modal|post-?bop|modern", "md"],
    ["bossa|latin|samba|bolero|brazil", "la"],
    ["ballads?", "bl"],
    ["\\bblues\\b", "bu"],
    ["waltz(es)?|3\\/4", "wz"],
    ["\\bpop\\b|r&b|soul\\b(?! jazz)", "po"],
    ["christmas|holiday|xmas", "xm"],
  ],
  chips: [],
  feels: ["", "Medium swing", "Up-tempo swing", "Ballad", "Bossa / Latin", "Jazz waltz", "Blues", "Straight 8ths / funk", "Trad / two-beat", "Modal"],
};

export const ROCK: GenreConfig = {
  key: "rock", name: "Rock", sign: "Rock Show", noun: "song", tagline: "",
  styles: { rr: "50s rock & roll", cr: "Classic rock", ar: "Arena & 80s rock", pk: "Punk & new wave", bl: "Slow songs", up: "Up-tempo", pa: "Party & singalong" },
  neighbors: { bl: [], up: [], pa: [], rr: [], cr: ["ar"], ar: ["cr", "pk"], pk: ["ar"] },
  words: [
    ["rock ?(and|&|n'?) ?roll|rockabilly|oldies", "rr"],
    ["classic rock", "cr"],
    ["arena|hair|stadium", "ar"],
    ["punk|new wave", "pk"],
    ["ballads?|\\bslow\\b|first dance|mellow|chill|quiet", "bl"],
    ["up-?tempo|upbeat|high[- ]energy|rockin|fast (songs|ones)", "up"],
    ["party|singalong|sing-along|crowd[- ]pleas|dance floor|dancefloor", "pa"],
  ],
  chips: [],
  feels: ["", "Slow / ballad", "Mid-tempo", "Up-tempo"],
};

let n = 0;
export function song(genre: GenreConfig, title: string, styles: string[], extra: Partial<Song> = {}): Song {
  n++;
  return {
    id: extra.id ?? `${genre.key}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    genre: genre.key, title, rank: extra.rank ?? n, styles, ...extra,
  };
}

export function repOf(entries: [string, Status, Partial<Repertoire[string]>?][]): Repertoire {
  const r: Repertoire = {};
  for (const [id, status, extra] of entries) r[id] = { status, ...(extra || {}) };
  return r;
}

/** A jazz book: `count` known tunes per style group, some ballads, some Latin, some up-tempo. */
export function jazzLibrary(opts: { standards?: number; ballads?: number; latin?: number; gypsy?: number; bebop?: number } = {}) {
  const songs: Song[] = [];
  const add = (prefix: string, k: number, styles: string[]) => {
    for (let i = 1; i <= k; i++) songs.push(song(JAZZ, `${prefix} ${i}`, styles));
  };
  add("Standard", opts.standards ?? 30, ["sb", "sw"]);
  add("Ballad", opts.ballads ?? 10, ["sb", "bl"]);
  add("Bossa", opts.latin ?? 6, ["la"]);
  add("Gypsy", opts.gypsy ?? 0, ["gy"]);
  add("Bop", opts.bebop ?? 0, ["bp"]);
  return songs;
}
