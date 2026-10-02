// Shared data model. Every module (data, engine, exports, practice, UI) builds on these types.

export type GenreKey =
  | "jazz" | "blues" | "country" | "rock" | "pop" | "rnb"
  | "folk" | "gospel" | "latin" | "reggae" | "hiphop" | "wedding";

export const GENRE_ORDER: GenreKey[] = [
  "jazz", "blues", "country", "rock", "pop", "rnb",
  "folk", "gospel", "latin", "reggae", "hiphop", "wedding",
];

/** How well the player knows a song. */
export type Status = "know" | "shaky" | "learn" | "no";

export const STATUSES: { value: Status; label: string; short: string; hotkey: string }[] = [
  { value: "know", label: "Know it", short: "Know", hotkey: "1" },
  { value: "shaky", label: "Shaky", short: "Shaky", hotkey: "2" },
  { value: "learn", label: "Want to learn", short: "Learn", hotkey: "3" },
  { value: "no", label: "Skip", short: "Skip", hotkey: "4" },
];

/** A catalog song. Research fields (composer etc.) are optional and filled in later. */
export interface Song {
  id: string;
  genre: GenreKey;
  title: string;
  /** Composer / artist credit as shown in the old app (free text). */
  artist?: string;
  /** Release / publish year when known. */
  year?: number;
  /** Popularity rank within its genre (1 = most popular). null for unranked/custom. */
  rank: number | null;
  /** Crowd favourite / "hit" flag. */
  hit?: boolean;
  /** Style codes, keys of GenreConfig.styles. */
  styles: string[];
  // --- research fields (to be populated later; UI shows "—" when missing) ---
  composer?: string;
  lyricist?: string;
  publishYear?: number;
  firstRecordedBy?: string;
  /** True for songs the user added themselves. */
  custom?: boolean;
}

/** A recording of a tune, as listed under "About this tune". */
export interface Recording {
  artist: string;
  year?: number;
  /** e.g. "as Ko-Ko" for a contrafact, or which album */
  note?: string;
  /** true when a cited source (Wikipedia's recordings list) names this recording */
  confirmed?: boolean;
}

/**
 * Background on a catalog tune: who wrote it, where it came from, the first and the landmark
 * recordings. Loaded per genre on demand (src/data/info/<genre>.json), built by scripts/research.
 */
export interface SongInfo {
  composer?: string;
  lyricist?: string;
  year?: number;
  /** The show or film it was written for */
  origin?: string;
  originKind?: "show" | "film";
  firstRecording?: Recording;
  famous?: Recording[];
  links?: { wikipedia?: string; wikidata?: string };
  /** Fields filled in from general knowledge rather than a cited source; shown as "unverified" */
  unverified?: ("composer" | "lyricist" | "year" | "origin" | "firstRecording")[];
}

export interface GenreConfig {
  key: GenreKey;
  /** e.g. "Jazz" */
  name: string;
  /** Neon sign text: the book's title, e.g. "Jazz Book" */
  sign: string;
  /** "tune" for jazz, "song" elsewhere */
  noun: "tune" | "song";
  tagline: string;
  /** style code -> label */
  styles: Record<string, string>;
  /** style code -> fallback style codes to borrow from when short */
  neighbors: Record<string, string[]>;
  /** [regex source (case-insensitive), style code] used to parse gig descriptions */
  words: [string, string][];
  /** Example prompts: [chip label, full prompt] */
  chips: [string, string][];
  /** Feel options for this genre ("" = not set) */
  feels: string[];
}

/** The user's relationship to one song. */
export interface RepEntry {
  status: Status | null;
  /** Key the user plays it in, e.g. "Bb", "Fm" */
  key?: string;
  /** One of GenreConfig.feels */
  feel?: string;
  notes?: string;
  /** Overrides Song.styles when set */
  styles?: string[];
}
export type Repertoire = Record<string, RepEntry>;

export type Setting = "standard" | "background" | "listening" | "jam" | "dance";

export const SETTINGS: { value: Setting; label: string }[] = [
  { value: "standard", label: "Standard gig" },
  { value: "background", label: "Background / dinner" },
  { value: "listening", label: "Listening room" },
  { value: "jam", label: "Jam session" },
  { value: "dance", label: "Dance" },
];

/** Numeric rule values. Keys match the old app so backups stay compatible. */
export interface Rules {
  minBallad: number; minMedium: number; minUp: number; minLatin: number;
  minWaltz: number; minBlues: number; minTwo: number; minModal: number;
  facBackground: number; facListening: number; facJam: number; facDance: number;
  breakMin: number; defaultHours: number;
  balladPct: number; balladHeavyPct: number; upMaxBackground: number;
  maxBalladsRow: number; maxBalladsRowHeavy: number;
  latinEvery: number; maxSameFeelRow: number;
  shakyMaxPerSet: number; shakyOnlyIfShort: number;
  recentLists: number; backups: number; popularBoost: number;
}

/** Everything the builder needs to know about a gig. */
export interface GigRequest {
  styles: string[];
  hours?: number;
  sets?: number;
  setMinutes?: number;
  /** "Just give me N songs" instead of a duration */
  count?: number;
  setting: Setting;
  date?: string;      // ISO yyyy-mm-dd
  venue?: string;
  /** Restrict to a saved Book (user list) */
  bookId?: string;
  allowShaky: boolean;
  /** Decade codes like "1960" or "pre" (non-jazz genres) */
  decades?: string[];
  /** Rank crowd favourites first */
  favourites?: boolean;
  /** Specific songs to build from */
  picks?: string[];
  keepOrder?: boolean;
  /** Song ids to leave out ("no Autumn Leaves") */
  exclude?: string[];
}

/**
 * "picked": the player chose this song themselves (builder bookkeeping, never printed).
 * "request": someone asked for it; the player marks this in the set list and exports show it.
 */
export type ItemFlag = "shaky" | "other-style" | "picked" | "request";

export interface SetItem {
  songId: string;
  /** Snapshot so exports still work if the catalog changes */
  title: string;
  artist?: string;
  key?: string;
  feel?: string;
  minutes: number;
  flags?: ItemFlag[];
  note?: string;
}

export interface GigSet {
  name: string; // "Set 1"
  items: SetItem[];
}

export interface SetList {
  id: string;
  genre: GenreKey;
  name: string;
  date?: string;
  venue?: string;
  setting: Setting;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  sets: GigSet[];
  /** Backup songs not in the sets */
  backups: SetItem[];
  /** Builder notes, e.g. "Set 2 runs 6 min short" */
  notes: string[];
  request?: GigRequest;
}

/** A named list of songs (e.g. an imported set list, "Trio book"). */
export interface Book {
  id: string;
  genre: GenreKey;
  name: string;
  ids: string[];
}
