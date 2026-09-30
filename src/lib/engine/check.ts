// Gentle rule checks for hand-edited sets (after drag-and-drop, swaps, key/feel edits).
import type { GenreConfig, GigSet, Repertoire, Rules, SetList, Setting, Song } from "../types";
import { itemFeel } from "./build";
import type { Feel } from "./feel";
import { isJazz, normKey, nouns } from "./util";

export type WarningRule =
  | "shaky-opener" | "shaky-closer" | "shaky-second" | "too-many-shaky"
  | "ballads-in-a-row" | "same-feel-row" | "same-key" | "duplicate"
  | "up-tempo-background" | "ballad-opener";

export interface Warning {
  setIndex: number;
  itemIndex?: number;
  rule: WarningRule | string;
  message: string;
}

export interface CheckContext {
  rules: Rules;
  genre: GenreConfig;
  songs?: Song[];
  rep?: Repertoire;
  /** Index of this set in its list (for Warning.setIndex). Default 0. */
  setIndex?: number;
  setting?: Setting;
  /** Force ballad-heavy pacing (normally: the gig asked for ballads, or over half the set is ballads). */
  balladHeavy?: boolean;
}

const FEEL_WORD: Record<Feel, string> = {
  ballad: "ballad", medium: "medium", up: "up-tempo", latin: "Latin", waltz: "waltz", blues: "blues", two: "two-beat", modal: "modal",
};

export function checkSet(set: GigSet, ctx: CheckContext): Warning[] {
  const { rules, genre } = ctx;
  const setIndex = ctx.setIndex ?? 0;
  const jazz = isJazz(genre);
  const { one, many } = nouns(genre);
  const ballad = jazz ? "ballad" : "slow song";
  const ballads = jazz ? "ballads" : "slow songs";
  const byId = new Map((ctx.songs || []).map((s) => [s.id, s] as const));
  const items = set.items;
  const out: Warning[] = [];
  const w = (rule: WarningRule, message: string, itemIndex?: number) =>
    out.push(itemIndex === undefined ? { setIndex, rule, message } : { setIndex, itemIndex, rule, message });
  if (!items.length) return out;

  const feels = items.map((it) => itemFeel(it, byId, ctx.rep, genre));
  const shaky = items.map((it) => !!it.flags?.includes("shaky") || ctx.rep?.[it.songId]?.status === "shaky");
  const title = (i: number) => `“${items[i].title}”`;

  // Duplicates
  const seen = new Map<string, number>();
  items.forEach((it, i) => {
    if (seen.has(it.songId)) w("duplicate", `${title(i)} is already in this set.`, i);
    else seen.set(it.songId, i);
  });

  // Shaky placement
  if (shaky[0]) w("shaky-opener", `${title(0)} is marked Shaky. Open with something you know solidly.`, 0);
  const lastI = items.length - 1;
  if (lastI > 0 && shaky[lastI]) w("shaky-closer", `${title(lastI)} is marked Shaky. Close with something you know solidly.`, lastI);
  if (items.length > 2 && shaky[1]) w("shaky-second", `${title(1)} is Shaky; try it later in the set, once the band has settled.`, 1);
  const nShaky = shaky.filter(Boolean).length;
  if (nShaky > rules.shakyMaxPerSet) w("too-many-shaky", `${nShaky} Shaky ${many} in this set (your limit is ${rules.shakyMaxPerSet}).`);

  // Ballad pacing
  const nBallads = feels.filter((f) => f === "ballad").length;
  const heavy = ctx.balladHeavy ?? nBallads > items.length * 0.5;
  const maxB = Math.max(1, heavy ? rules.maxBalladsRowHeavy : rules.maxBalladsRow);
  if (!heavy && items.length > 1 && feels[0] === "ballad") w("ballad-opener", `Opening on a ${ballad}; a mid-tempo ${one} usually gets things going better.`, 0);
  let run = 0;
  feels.forEach((f, i) => {
    run = f === "ballad" ? run + 1 : 0;
    if (run === maxB + 1) w("ballads-in-a-row", `${run} ${ballads} in a row (your limit is ${maxB}).`, i);
  });

  // Same feel in a row (ballads are handled above)
  let fr = 0;
  feels.forEach((f, i) => {
    fr = i > 0 && feels[i - 1] === f ? fr + 1 : 1;
    // Medium swing / mid-tempo is the default feel, so long runs of it are fine.
    if (f !== "ballad" && f !== "medium" && fr === rules.maxSameFeelRow + 1) {
      w("same-feel-row", `${fr} ${jazz ? FEEL_WORD[f] : "up-tempo"} ${many} in a row (your limit is ${rules.maxSameFeelRow}).`, i);
    }
  });

  // Same key back to back
  for (let i = 1; i < items.length; i++) {
    const a = normKey(items[i - 1].key), b = normKey(items[i].key);
    if (a && a === b) w("same-key", `${title(i - 1)} and ${title(i)} are both in ${items[i].key}.`, i);
  }

  // Background gigs: go easy on up-tempo
  if (ctx.setting === "background") {
    const ups = feels.filter((f) => f === "up").length;
    if (ups > rules.upMaxBackground) w("up-tempo-background", `${ups} up-tempo ${many} in a background set (your limit is ${rules.upMaxBackground}).`);
  }
  return out;
}

/** Check every set, plus songs that appear in more than one set. */
export function checkSetList(sl: SetList, ctx: Omit<CheckContext, "setIndex" | "setting"> & { setting?: Setting }): Warning[] {
  const out: Warning[] = [];
  const heavy = ctx.balladHeavy ?? (sl.request?.styles || []).includes("bl");
  sl.sets.forEach((s, i) => out.push(...checkSet(s, { ...ctx, setIndex: i, setting: ctx.setting ?? sl.setting, balladHeavy: heavy || undefined })));
  const where = new Map<string, number>();
  sl.sets.forEach((s, si) => s.items.forEach((it, ii) => {
    const prev = where.get(it.songId);
    if (prev !== undefined && prev !== si) {
      out.push({ setIndex: si, itemIndex: ii, rule: "duplicate", message: `“${it.title}” is also in ${sl.sets[prev].name}.` });
    } else if (prev === undefined) where.set(it.songId, si);
  }));
  return out;
}
