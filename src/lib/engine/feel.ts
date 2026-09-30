// Feels (tempo/groove buckets) and how long a song runs.
import type { GenreConfig, RepEntry, Rules, Setting, Song } from "../types";
import { isJazz, round2, stylesOf } from "./util";

export type Feel = "ballad" | "medium" | "up" | "latin" | "waltz" | "blues" | "two" | "modal";

/** Jazz tunes usually called at a brisk tempo (used when the player hasn't set a feel). */
export const UP_TUNES: ReadonlySet<string> = new Set(
  "cherokee donna-lee indiana-back-home-again-in-indiana oleo giant-steps cottontail lester-leaps-in sweet-georgia-brown after-you-ve-gone limehouse-blues tiger-rag china-boy i-got-rhythm just-one-of-those-things lover get-happy salt-peanuts hot-house dizzy-atmosphere shaw-nuff move be-bop 52nd-street-theme anthropology countdown rhythm-a-ning woody-n-you crazy-rhythm runnin-wild them-there-eyes swing-42 djangology dinah avalon i-ve-found-a-new-baby undecided caravan what-is-this-thing-called-love how-high-the-moon liza-all-the-clouds-ll-roll-away the-sheik-of-araby flying-home air-mail-special seven-come-eleven sing-sing-sing bugle-call-rag that-s-a-plenty fidgety-feet sugar-foot-stomp king-porter-stomp dark-eyes hungaria swing-48 artillerie-lourde viper-s-dream babik rythme-futur tchavolo-swing gin-gin stompin-at-decca impressions milestones airegin moment-s-notice tune-up i-ll-remember-april just-you-just-me lover-come-back-to-me jumpin-at-the-woodside i-want-to-be-happy strike-up-the-band fine-and-dandy hallelujah it-don-t-mean-a-thing the-song-is-you there-will-never-be-another-you minor-swing i-know-that-you-know shine chinatown-my-chinatown groovin-high dexterity bebop cheryl half-nelson lady-be-good-2 ornithology confirmation scrapple-from-the-apple rose-room tea-for-two".split(" "),
);

/** Every feel label the old and new apps have used, lower-cased, mapped to its bucket. */
const FEEL_FROM_LABEL: Record<string, Feel> = {
  "slow / ballad": "ballad", slow: "ballad", ballad: "ballad",
  "mid-tempo": "medium", "medium swing": "medium", medium: "medium", "straight 8ths / funk": "medium",
  "up-tempo": "up", "up-tempo swing": "up", up: "up",
  "bossa / latin": "latin", latin: "latin",
  "jazz waltz": "waltz", waltz: "waltz",
  blues: "blues",
  "trad / two-beat": "two", "two-beat": "two", two: "two",
  modal: "modal",
};

/** Map a feel label ("Medium swing", "Slow / ballad", ...) to its bucket, or undefined. */
export function feelFromLabel(label: string | undefined): Feel | undefined {
  if (!label) return undefined;
  return FEEL_FROM_LABEL[label.trim().toLowerCase()];
}

/** Which feel a song is played with: the player's own setting wins, then the style tags. */
export function feelOf(song: Song, entry: RepEntry | undefined, genre: GenreConfig): Feel {
  const own = feelFromLabel(entry?.feel);
  if (own) return narrowFeel(own, genre);
  const g = stylesOf(song, entry);
  if (!isJazz(genre)) return g.includes("bl") ? "ballad" : g.includes("up") ? "up" : "medium";
  if (g.includes("bl")) return "ballad";
  if (g.includes("wz")) return "waltz";
  if (UP_TUNES.has(song.id)) return "up";
  if (g.includes("la") && !g.some((c) => ["sw", "bp", "hb", "gy", "tr"].includes(c))) return "latin";
  if (g.includes("bu") && !g.includes("sb")) return "blues";
  if (g.includes("md") && !g.some((c) => ["sb", "sw"].includes(c))) return "modal";
  if (g.includes("tr") && !g.some((c) => ["sw", "bp", "hb", "sb"].includes(c))) return "two";
  return "medium";
}

/** Non-jazz genres only have slow / mid / up. */
function narrowFeel(f: Feel, genre: GenreConfig): Feel {
  if (isJazz(genre)) return f;
  return f === "ballad" || f === "up" ? f : "medium";
}

const PREFERRED_LABEL_JAZZ: Record<Feel, string> = {
  ballad: "Ballad", medium: "Medium swing", up: "Up-tempo swing", latin: "Bossa / Latin",
  waltz: "Jazz waltz", blues: "Blues", two: "Trad / two-beat", modal: "Modal",
};
const PREFERRED_LABEL_OTHER: Record<string, string> = { ballad: "Slow / ballad", medium: "Mid-tempo", up: "Up-tempo" };

/** Display label for a feel, chosen from the genre's own feel list so it round-trips through feelFromLabel. */
export function feelLabel(feel: Feel, genre: GenreConfig): string {
  const f = narrowFeel(feel, genre);
  const pref = isJazz(genre) ? PREFERRED_LABEL_JAZZ[f] : PREFERRED_LABEL_OTHER[f];
  const list = (genre.feels || []).filter(Boolean);
  if (!list.length || list.includes(pref)) return pref;
  return list.find((l) => feelFromLabel(l) === f) ?? pref;
}

/** Percentage multiplier for the kind of gig. */
export function settingFactor(setting: Setting | undefined, rules: Rules): number {
  switch (setting) {
    case "background": return rules.facBackground / 100;
    case "listening": return rules.facListening / 100;
    case "jam": return rules.facJam / 100;
    case "dance": return rules.facDance / 100;
    default: return 1;
  }
}

/** Base minutes for a feel before the room factor. */
export function baseMinutes(feel: Feel, rules: Rules): number {
  const m: Record<Feel, number> = {
    ballad: rules.minBallad, medium: rules.minMedium, up: rules.minUp, latin: rules.minLatin,
    waltz: rules.minWaltz, blues: rules.minBlues, two: rules.minTwo, modal: rules.minModal,
  };
  const v = m[feel];
  return typeof v === "number" && v > 0 ? v : 6;
}

export function minutesForFeel(feel: Feel, rules: Rules, setting: Setting | undefined): number {
  return round2(baseMinutes(feel, rules) * settingFactor(setting, rules));
}

/** How long this song runs at this kind of gig. */
export function minutesFor(song: Song, entry: RepEntry | undefined, genre: GenreConfig, rules: Rules, setting: Setting): number {
  return minutesForFeel(feelOf(song, entry, genre), rules, setting);
}
