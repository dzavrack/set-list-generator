// The set-list builder: picks songs, balances the mix, deals them across sets and orders each set.
import type {
  Book, GenreConfig, GigRequest, GigSet, ItemFlag, RepEntry, Repertoire, Rules, SetItem, SetList, Song,
} from "../types";
import { feelFromLabel, feelLabel, feelOf, minutesForFeel, UP_TUNES, type Feel } from "./feel";
import { autoName, type EngineGigRequest } from "./parse";
import { makeRng, type Rand } from "./rng";
import { planShape } from "./shape";
import { decadeOf, isJazz, normKey, normTitle, nouns, plural, splitStyles, stylesOf } from "./util";

export interface BuildInput {
  request: GigRequest;
  songs: Song[];
  rep: Repertoire;
  rules: Rules;
  genre: GenreConfig;
  /** Saved set lists; the most recent `rules.recentLists` of this genre push their songs down the ranking. */
  recent?: SetList[];
  books?: Book[];
  /** Same seed + same inputs = same set list. "Shuffle" = new seed. */
  seed?: number;
  name?: string;
  /** ISO timestamp for createdAt/updatedAt and the id (keeps the module pure). */
  now?: string;
}

/** Internal candidate record. */
interface Cand {
  song: Song;
  entry: RepEntry | undefined;
  id: string;
  title: string;
  rank: number | null;
  feel: Feel;
  playFeel: Feel;
  key: string;
  /** Marked Shaky (outside picks mode) */
  shaky: boolean;
  /** A Shaky song the player hand-picked */
  pickShaky: boolean;
  /** Hand-picked by the player (never swapped out by the mix balancing) */
  picked: boolean;
  /** From a neighbouring style or another decade */
  outside: boolean;
  latinable: boolean;
  score: number;
  note: string;
}

const EPOCH = "1970-01-01T00:00:00.000Z";

export function buildSetList(input: BuildInput): SetList {
  const { songs, rep, rules, genre } = input;
  const q = input.request as EngineGigRequest;
  const seed = Number.isFinite(input.seed) ? (input.seed as number) : 1;
  const now = input.now || EPOCH;
  const rand = makeRng(seed);
  const jazz = isJazz(genre);
  const { one, many } = nouns(genre);
  const setting = q.setting || "standard";
  const { styles: S, tempo } = splitStyles(q.styles || [], genre);
  const decades = q.decades && q.decades.length ? q.decades : null;
  const heavy = S.includes("bl") || tempo.includes("bl");
  const onlyBallad = S.length === 1 && S[0] === "bl";
  const latinReq = jazz && S.includes("la");
  const onlyLatin = jazz && S.length === 1 && S[0] === "la";
  const notes: string[] = [];

  // --- songs from the most recent saved set lists rank lower ---
  const recentIds = new Set<string>();
  const recentTitles = new Set<string>();
  if (rules.recentLists > 0) {
    (input.recent || [])
      .filter((sl) => sl.genre === genre.key)
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, rules.recentLists)
      .forEach((sl) => sl.sets.forEach((st) => st.items.forEach((it) => { recentIds.add(it.songId); recentTitles.add(normTitle(it.title)); })));
  }
  const excl = new Set<string>();
  for (const x of q.exclude || []) { excl.add(x); excl.add(normTitle(x)); }
  const book = q.bookId ? (input.books || []).find((b) => b.id === q.bookId) : undefined;
  const bookIds = book ? new Set(book.ids) : null;
  const picks = q.picks && q.picks.length ? q.picks : null;
  const PK = !!picks;
  const keepOrder = PK && !!q.keepOrder;
  const pickIndex = new Map<string, number>();
  (picks || []).forEach((id, i) => { if (!pickIndex.has(id)) pickIndex.set(id, i); });
  // Picks plus a length: the picks go in first and known songs fill the rest of the time.
  const fill = PK && (q.hours != null || q.setMinutes != null || (q.count != null && q.count > (picks as string[]).length));
  const boostPopular = (!!rules.popularBoost && (setting === "background" || setting === "dance")) || !!q.favourites;

  // --- candidates ---
  const cands: Cand[] = [];
  const seen = new Set<string>();
  for (const song of songs) {
    if (song.genre && song.genre !== genre.key) continue;
    if (seen.has(song.id)) continue; // never the same song twice
    const entry = rep[song.id];
    const status = entry?.status ?? null;
    const picked = PK && pickIndex.has(song.id);
    if (!picked && (PK && !fill ? true : status !== "know" && status !== "shaky")) continue;
    if (excl.has(song.id) || excl.has(normTitle(song.title))) continue;
    if (bookIds && !bookIds.has(song.id)) continue;
    const g = stylesOf(song, entry);
    // Wedding: ceremony-only music stays out unless asked for
    if (genre.key === "wedding" && !S.includes("ce") && !picked) {
      const sg = g.filter((c) => !["bl", "up", "pa"].includes(c));
      if (sg.length === 1 && sg[0] === "ce") continue;
    }
    const decOK = picked || !decades || decades.includes(decadeOf(song));
    const match = picked ? 1 : S.length ? S.filter((c) => g.includes(c)).length : 1;
    const near = !match && S.length ? S.some((c) => (genre.neighbors[c] || []).some((n) => g.includes(n))) : false;
    if (!match && !near) continue;
    seen.add(song.id);
    const feel = feelOf(song, entry, genre);
    let score = 1 + match * 0.6 + rand() * 1.2;
    if (boostPopular) score += jazz ? (song.rank ? (song.rank <= 100 ? 1 : song.rank <= 300 ? 0.5 : 0) : 0) : song.hit ? 1.1 : 0;
    if (!jazz && song.hit) score += 0.3;
    for (const tp of tempo) if (g.includes(tp)) score += 0.8;
    if (!picked && (recentIds.has(song.id) || recentTitles.has(normTitle(song.title)))) score -= 0.9;
    if (picked) {
      const idx = pickIndex.get(song.id) as number;
      // Fix: with "keep my order", which picks make the cut follows your order (old code let a random
      // jitter 50x larger than the order step decide).
      score = 10 - idx * 0.01 + (keepOrder ? 0 : rand() * 0.5);
    }
    if (status === "shaky" && !keepOrder) score -= 0.5;
    if (!decOK) score -= 0.6;
    cands.push({
      song, entry, id: song.id, title: song.title, rank: song.rank, feel, playFeel: feel,
      key: entry?.key ? String(entry.key).trim() : "",
      shaky: !picked && status === "shaky", pickShaky: picked && status === "shaky", picked,
      outside: !match || !decOK, latinable: jazz && g.includes("la"), score, note: "",
    });
  }
  const byScore = (a: Cand[]) => a.slice().sort((x, y) => y.score - x.score);
  const inStyleKnow = cands.filter((c) => !c.outside && !c.shaky);

  // --- how many songs ---
  const shape = planShape(q, rules);
  let perSet: number[] = [];
  if (PK && !fill) {
    // Just the picks: share them across the sets asked for (one set if none).
    const n = cands.length;
    const k = Math.max(1, Math.min(q.sets ?? 1, n || 1));
    perSet = Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
  } else if (shape.count) perSet = [shape.count];
  else {
    const pool = inStyleKnow.length ? inStyleKnow : cands;
    const avg = pool.length
      ? pool.reduce((a, c) => a + minutesForFeel(c.feel, rules, setting), 0) / pool.length
      : minutesForFeel("medium", rules, setting);
    for (let i = 0; i < shape.sets; i++) perSet.push(Math.max(3, Math.round(shape.minutesPerSet / avg)));
  }
  const need = perSet.reduce((a, b) => a + b, 0);

  // --- choose: in-style Know-it first, then Shaky, then neighbouring styles ---
  let chosen = byScore(inStyleKnow).slice(0, need);
  const shakyCap = Math.max(0, rules.shakyMaxPerSet) * perSet.length;
  const shakyOnlyIfShort = !!rules.shakyOnlyIfShort;
  if (q.allowShaky && (!shakyOnlyIfShort || chosen.length < need)) {
    const add = byScore(cands.filter((c) => !c.outside && c.shaky)).slice(
      0,
      Math.max(0, Math.min(shakyCap, need - chosen.length + (shakyOnlyIfShort ? 0 : perSet.length))),
    );
    if (!shakyOnlyIfShort) chosen = chosen.slice(0, Math.max(0, need - add.length)); // swap weakest Know-it for Shaky
    chosen = chosen.concat(add);
  }
  if (chosen.length < need) {
    const add = byScore(cands.filter((c) => c.outside && !c.shaky)).slice(0, need - chosen.length);
    chosen = chosen.concat(add);
  }
  const outsideAllowed = chosen.some((c) => c.outside);
  if (chosen.length < need) {
    notes.push(`You only have ${plural(chosen.length, one)} that fit, so the sets run shorter than asked.`);
    const ratio = chosen.length / Math.max(1, need);
    perSet = perSet.map((n) => Math.max(chosen.length ? 1 : 0, Math.floor(n * ratio)));
    let diff = chosen.length - perSet.reduce((a, b) => a + b, 0);
    for (let i = 0; diff > 0; i = (i + 1) % perSet.length, diff--) perSet[i]++;
    // Fix: when there are fewer songs than sets, the old code still promised one per set.
    for (let i = perSet.length - 1; diff < 0 && i >= 0; i--) while (diff < 0 && perSet[i] > 0) { perSet[i]--; diff++; }
  }

  // --- balance the mix: ballads, Latin, and up-tempo at background gigs ---
  const total = perSet.reduce((a, b) => a + b, 0);
  const isBallad = (c: Cand) => c.feel === "ballad";
  const isLatin = (c: Cand) => c.feel === "latin" || (c.latinable && c.feel !== "ballad");
  const wantBallads = onlyBallad ? total : Math.round((total * (heavy ? rules.balladHeavyPct : rules.balladPct)) / 100);
  const wantLatin = !jazz ? 0 : onlyLatin ? total : latinReq ? Math.max(Math.round(total / 3), 1) : Math.floor(total / Math.max(2, rules.latinEvery));
  // Fix: swaps no longer sneak in Shaky songs when Shaky is "only if short" (and not beyond the cap).
  const shakyInChosen = () => chosen.filter((c) => c.shaky).length;
  const unused = () =>
    cands.filter((c) =>
      !chosen.includes(c) &&
      (!c.shaky || (q.allowShaky && !shakyOnlyIfShort && shakyInChosen() < shakyCap)) &&
      (!c.outside || outsideAllowed));
  const swapIn = (pred: (c: Cand) => boolean, want: number, protect: (c: Cand) => boolean) => {
    let have = chosen.filter(pred).length;
    while (have < want) {
      const inc = byScore(unused().filter(pred))[0];
      if (!inc) break;
      // Fix: drop the weakest song that isn't part of another quota (old code could swap a ballad out for a Latin tune).
      const pool = chosen.filter((c) => !pred(c) && !protect(c) && !c.picked && !(c.shaky && !shakyOnlyIfShort));
      const drop = (pool.length ? pool : chosen.filter((c) => !pred(c) && !c.picked)).sort((a, b) => a.score - b.score)[0];
      if (!drop) break;
      chosen[chosen.indexOf(drop)] = inc;
      have++;
    }
  };
  if (!keepOrder && total > 0) {
    if (!onlyLatin) {
      swapIn(isBallad, Math.min(wantBallads, total), (c) => jazz && isLatin(c));
      if (!onlyBallad) {
        const max = Math.round((total * (heavy ? Math.max(rules.balladHeavyPct, 60) : Math.max(rules.balladPct + 10, 30))) / 100);
        while (chosen.filter(isBallad).length > max) {
          const inc = byScore(unused().filter((c) => !isBallad(c)))[0];
          if (!inc) break;
          const drop = chosen.filter((c) => isBallad(c) && !c.picked).sort((a, b) => a.score - b.score)[0];
          if (!drop) break;
          chosen[chosen.indexOf(drop)] = inc;
        }
      }
    }
    if (!onlyBallad && wantLatin > 0) swapIn(isLatin, Math.min(wantLatin, total), isBallad);
    if (setting === "background") {
      const cap = rules.upMaxBackground * perSet.length;
      while (chosen.filter((c) => c.feel === "up").length > cap) {
        const inc = byScore(unused().filter((c) => c.feel === "medium" || c.feel === "latin" || c.feel === "two"))[0];
        if (!inc) break;
        const drop = chosen.filter((c) => c.feel === "up" && !c.picked).sort((a, b) => a.score - b.score)[0];
        if (!drop) break;
        chosen[chosen.indexOf(drop)] = inc;
      }
    }
  }
  // Tunes chosen for a Latin slot but normally swung get played as a bossa (never up-tempo burners)
  const latinCount = chosen.filter((c) => c.feel === "latin").length;
  let toConvert = keepOrder ? 0 : Math.max(0, (onlyBallad ? 0 : wantLatin) - latinCount);
  for (const c of chosen) { c.playFeel = c.feel; c.note = ""; }
  for (const c of chosen) {
    if (toConvert > 0 && c.latinable && c.feel === "medium" && !UP_TUNES.has(c.id)) {
      c.playFeel = "latin"; c.note = "Try it with a Latin/bossa feel"; toConvert--;
    }
  }

  // --- deal across sets so each gets its share of ballads, Latin, up-tempo and strong songs ---
  let ordered: Cand[][];
  if (keepOrder) {
    const flat = [...pickIndex.keys()].map((id) => chosen.find((c) => c.id === id)).filter((c): c is Cand => !!c)
      .concat(byScore(chosen.filter((c) => !c.picked)));
    ordered = [];
    let i = 0;
    for (const n of perSet) { ordered.push(flat.slice(i, i + n)); i += n; }
  } else {
    const sets: Cand[][] = perSet.map(() => []);
    const full = (i: number) => sets[i].length >= perSet[i];
    const shakyIn = (i: number) => sets[i].filter((c) => c.shaky || c.pickShaky).length;
    const cats = [
      chosen.filter((c) => c.playFeel === "ballad"),
      chosen.filter((c) => c.playFeel === "latin"),
      chosen.filter((c) => c.playFeel === "up"),
      chosen.filter((c) => !["ballad", "latin", "up"].includes(c.playFeel)),
    ];
    let si = 0;
    outer: for (const cat of cats) {
      for (const c of byScore(cat)) {
        // Fix: respect the per-set Shaky cap while dealing (old code only capped the night's total).
        let tries = 0;
        const ok = (i: number) => !full(i) && (!(c.shaky || c.pickShaky) || shakyIn(i) < Math.max(1, rules.shakyMaxPerSet));
        while (!ok(si) && tries < sets.length) { si = (si + 1) % sets.length; tries++; }
        if (!ok(si)) {
          const j = sets.findIndex((_, k) => !full(k));
          if (j < 0) break outer;
          si = j;
        }
        sets[si].push(c);
        si = (si + 1) % sets.length;
      }
    }
    const placed = new Set(sets.flat());
    for (const c of chosen) if (!placed.has(c)) { const i = sets.findIndex((s, j) => s.length < perSet[j]); if (i >= 0) sets[i].push(c); }
    ordered = sets.map((s) => orderSet(s, rand, rules, heavy || onlyBallad || s.filter((c) => c.playFeel === "ballad").length > s.length * 0.5));
  }

  // --- backups ---
  const usedIds = new Set(ordered.flat().map((c) => c.id));
  const backupCands = PK && !fill
    ? cands.filter((c) => !usedIds.has(c.id)).sort((a, b) => (pickIndex.get(a.id) as number) - (pickIndex.get(b.id) as number))
    : PK
      ? (() => {
          const leftPicks = cands.filter((c) => c.picked && !usedIds.has(c.id)).sort((a, b) => (pickIndex.get(a.id) as number) - (pickIndex.get(b.id) as number));
          // Picks that didn't fit are the backups; otherwise suggest the usual few.
          return leftPicks.length ? leftPicks : byScore(cands.filter((c) => !c.picked && !usedIds.has(c.id) && !c.shaky && !c.outside)).slice(0, Math.max(0, rules.backups));
        })()
      : byScore(cands.filter((c) => !usedIds.has(c.id) && !c.shaky && !c.outside)).slice(0, Math.max(0, rules.backups));

  // --- notes ---
  const final0 = () => ordered.flat();
  if (PK) {
    const left = cands.filter((c) => c.picked && !usedIds.has(c.id)).length;
    if (fill) {
      const filled = final0().filter((c) => !c.picked).length;
      if (filled) notes.push(`Added ${plural(filled, one)} you know to fill out the time around your picks.`);
    }
    if (left > 0) notes.push(`${left} of your picked ${many} didn't fit in the time, so they're listed as backups.`);
  }
  const final = ordered.flat();
  const shakyUsed = final.filter((c) => c.shaky).length;
  const outsideUsed = final.filter((c) => c.outside).length;
  if (shakyUsed) {
    notes.push(`${plural(shakyUsed, "Shaky " + one)} included${shakyOnlyIfShort ? " to fill time" : ""}; they're kept away from the start and end of each set.`);
  }
  if (outsideUsed) {
    notes.push(`${outsideUsed} ${one}${outsideUsed > 1 ? "s are" : " is"} from outside what you asked for (a neighbouring style${decades ? " or another decade" : ""}) because you haven't marked enough that fit yet.`);
  }
  if (!keepOrder && jazz && chosen.some((c) => c.note)) {
    const n = chosen.filter((c) => c.note).length;
    notes.push(`${plural(n, "standard")} with a Latin tag ${n > 1 ? "are" : "is"} suggested as a bossa to keep the Latin mix up.`);
  }
  if (outsideUsed || shakyUsed) {
    const learn = songs
      .filter((t) => (!t.genre || t.genre === genre.key) && rep[t.id]?.status === "learn" && S.some((c) => stylesOf(t, rep[t.id]).includes(c)))
      .slice(0, 3)
      .map((t) => t.title);
    if (learn.length) notes.push("Worth learning for this kind of gig: " + learn.join(", ") + ".");
  }

  const names = perSet.length > 1 ? ordered.map((_, i) => "Set " + (i + 1)) : [shape.count ? nouns(genre).Many : "Set 1"];
  const toItem = (c: Cand): SetItem => {
    const flags: ItemFlag[] = [];
    if (c.shaky || c.pickShaky) flags.push("shaky");
    if (c.outside) flags.push("other-style");
    if (c.picked) flags.push("picked");
    // Keep the player's own feel wording when it still describes how it's played.
    const label = c.entry?.feel && feelFromLabel(c.entry.feel) === c.playFeel ? c.entry.feel : feelLabel(c.playFeel, genre);
    const item: SetItem = { songId: c.id, title: c.title, feel: label, minutes: minutesForFeel(c.playFeel, rules, setting) };
    if (c.song.artist) item.artist = c.song.artist;
    if (c.key) item.key = c.key;
    if (flags.length) item.flags = flags;
    if (c.note) item.note = c.note;
    return item;
  };
  const gigSets: GigSet[] = ordered.map((s, i) => ({ name: names[i], items: s.map(toItem) }));

  // Sets that land well off the asked-for length
  if (!shape.count && final.length && !(PK && !fill)) {
    gigSets.forEach((st) => {
      const diff = setMinutes(st) - shape.minutesPerSet;
      if (diff <= -5) notes.push(`${st.name} runs about ${-diff} min short.`);
      else if (diff >= 5) notes.push(`${st.name} runs about ${diff} min long.`);
    });
  }

  return {
    id: makeId(seed, now),
    genre: genre.key,
    name: input.name || autoName(q, genre),
    ...(q.date ? { date: q.date } : {}),
    ...(q.venue ? { venue: q.venue } : {}),
    setting,
    createdAt: now,
    updatedAt: now,
    sets: gigSets,
    backups: backupCands.map(toItem),
    notes,
    request: { ...q },
  };
}

function makeId(seed: number, now: string): string {
  const t = Date.parse(now);
  return `sl-${(Number.isFinite(t) ? t : 0).toString(36)}-${(seed >>> 0).toString(36)}`;
}

/** Strong opener, strong closer, variety in between. */
function orderSet(s: Cand[], rand: Rand, rules: Rules, balladHeavy: boolean): Cand[] {
  if (s.length <= 1) return s.slice();
  const left = s.slice();
  const strong = (c: Cand) => ["up", "medium", "two", "blues"].includes(c.playFeel) && !c.shaky && !c.pickShaky && !c.outside;
  const isShaky = (c: Cand) => c.shaky || c.pickShaky;
  const take = (c: Cand) => { left.splice(left.indexOf(c), 1); return c; };
  const pop = (c: Cand) => (c.rank ? Math.max(0, 1 - c.rank / 600) : 0.2);
  const best = (a: Cand[]) => a.slice().sort((x, y) => y.score + pop(y) - (x.score + pop(x)))[0];
  const opener =
    best(left.filter((c) => strong(c) && c.playFeel !== "up")) ||
    left.filter(strong)[0] ||
    left.filter((c) => !isShaky(c) && c.playFeel !== "ballad")[0] ||
    left.filter((c) => !isShaky(c))[0] ||
    left[0];
  take(opener);
  let closer: Cand | null = null;
  if (left.length) {
    closer =
      best(left.filter((c) => c.playFeel === "up" && !isShaky(c) && !c.outside)) ||
      best(left.filter(strong)) ||
      left.filter((c) => !isShaky(c) && c.playFeel !== "ballad")[0] ||
      left.filter((c) => !isShaky(c))[0] ||
      left[0];
    take(closer);
  }
  const seq = [opener];
  const maxB = Math.max(1, balladHeavy ? rules.maxBalladsRowHeavy : rules.maxBalladsRow);
  while (left.length) {
    const prev = seq[seq.length - 1];
    const last = left.length === 1;
    let pick: Cand = left[0];
    let bestP = 1e9;
    const bLeft = left.filter((x) => x.playFeel === "ballad").length;
    const oLeft = left.length - bLeft;
    let run = 0;
    for (let i = seq.length - 1; i >= 0 && seq[i].playFeel === "ballad"; i--) run++;
    // Key pressure: if one key fills half the remaining slots, it has to go every other song or
    // two will end up back to back (the old greedy order often painted itself into that corner).
    const keyCount = new Map<string, number>();
    for (const x of closer ? left.concat(closer) : left) {
      const k = normKey(x.key);
      if (k) keyCount.set(k, (keyCount.get(k) || 0) + 1);
    }
    const slots = left.length + (closer ? 1 : 0);
    let crowded = "";
    for (const [k, n] of keyCount) if (n * 2 >= slots && n > 1 && k !== normKey(prev.key)) crowded = k;
    for (const c of left) {
      let p = rand() * 0.8;
      // spread ballads out: if many remain, don't use up the other songs too early
      if (c.playFeel !== "ballad" && bLeft / maxB - oLeft > 0) p += 1.5;
      if (c.playFeel === "ballad" && run >= maxB) p += 10;
      let fr = 0;
      for (let i = seq.length - 1; i >= 0 && seq[i].playFeel === c.playFeel; i--) fr++;
      if (c.playFeel !== "medium" && c.playFeel !== "ballad" && fr >= 1) p += 3;
      if (fr >= rules.maxSameFeelRow) p += 6;
      if (c.key && prev.key && normKey(c.key) === normKey(prev.key)) p += 5;
      if (crowded && normKey(c.key) !== crowded) p += 4;
      if (isShaky(c) && seq.length < 2) p += 4;
      if (c.playFeel === "up" && prev.playFeel === "up") p += 2;
      if (last && closer) {
        if (c.playFeel === "ballad" && closer.playFeel === "ballad") p += 3;
        // Fix: the old code never compared the last middle song with the closer, so they could share a key.
        if (c.key && closer.key && normKey(c.key) === normKey(closer.key)) p += 5;
      }
      if (p < bestP) { bestP = p; pick = c; }
    }
    seq.push(take(pick));
  }
  if (closer) seq.push(closer);
  return fixKeys(seq, !!closer);
}

/**
 * Repair pass for same-key neighbours the greedy order couldn't avoid: swap a middle song with another
 * middle song of the same feel and Shaky status (so pacing, opener and closer are untouched) whenever
 * that lowers the number of back-to-back keys.
 */
function fixKeys(seq: Cand[], hasCloser: boolean): Cand[] {
  const out = seq.slice();
  const k = (c: Cand) => normKey(c.key);
  const clashes = () => {
    let n = 0;
    for (let i = 1; i < out.length; i++) if (k(out[i]) && k(out[i]) === k(out[i - 1])) n++;
    return n;
  };
  const lo = 1, hi = out.length - (hasCloser ? 2 : 1);
  let cur = clashes();
  for (let guard = 0; cur > 0 && guard < 50; guard++) {
    let improved = false;
    for (let i = lo; i <= hi && !improved; i++) {
      for (let j = lo; j <= hi && !improved; j++) {
        if (i === j || out[i].playFeel !== out[j].playFeel || (out[i].shaky || out[i].pickShaky) !== (out[j].shaky || out[j].pickShaky)) continue;
        [out[i], out[j]] = [out[j], out[i]];
        const n = clashes();
        if (n < cur) { cur = n; improved = true; } else [out[i], out[j]] = [out[j], out[i]];
      }
    }
    if (!improved) break;
  }
  return out;
}

/** Whole minutes a set runs. */
export function setMinutes(set: GigSet): number {
  return Math.round(set.items.reduce((a, t) => a + (Number(t.minutes) || 0), 0));
}

/** Total minutes of music across all sets (no breaks). */
export function listMinutes(sl: SetList): number {
  return sl.sets.reduce((a, s) => a + setMinutes(s), 0);
}

/** Feel an item is played with: its own label, else what the song/repertoire says. */
export function itemFeel(item: SetItem, songs: Song[] | Map<string, Song> | undefined, rep: Repertoire | undefined, genre: GenreConfig): Feel {
  const f = feelFromLabel(item.feel);
  if (f) return isJazz(genre) ? f : f === "ballad" || f === "up" ? f : "medium";
  const song = songs instanceof Map ? songs.get(item.songId) : songs?.find((s) => s.id === item.songId);
  return song ? feelOf(song, rep?.[item.songId], genre) : "medium";
}

/** Recompute item minutes after the user edits feels, order or the setting. Pure: returns a new SetList. */
export function retime(setList: SetList, songs: Song[], rep: Repertoire, rules: Rules, genre: GenreConfig): SetList {
  const byId = new Map(songs.map((s) => [s.id, s] as const));
  const fix = (it: SetItem): SetItem => ({ ...it, minutes: minutesForFeel(itemFeel(it, byId, rep, genre), rules, setList.setting) });
  return {
    ...setList,
    sets: setList.sets.map((s) => ({ ...s, items: s.items.map(fix) })),
    backups: setList.backups.map(fix),
  };
}

/**
 * A replacement for one item ("swap this song"): a Know-it song in the requested styles that isn't in
 * the list yet, preferring the same feel. Deterministic by seed (the old swap used Math.random).
 */
export function suggestReplacement(
  setList: SetList,
  setIndex: number,
  itemIndex: number,
  ctx: { songs: Song[]; rep: Repertoire; rules: Rules; genre: GenreConfig; seed?: number },
): SetItem | null {
  const { songs, rep, rules, genre } = ctx;
  const old = setList.sets[setIndex]?.items[itemIndex];
  const used = new Set(setList.sets.flatMap((s) => s.items.map((t) => t.songId)));
  const { styles: S } = splitStyles(setList.request?.styles || [], genre);
  const pool = songs.filter((t) => {
    if (t.genre && t.genre !== genre.key) return false;
    if (rep[t.id]?.status !== "know" || used.has(t.id)) return false;
    const g = stylesOf(t, rep[t.id]);
    return !S.length || S.some((c) => g.includes(c));
  });
  if (!pool.length) return null;
  const oldFeel = old ? itemFeel(old, songs, rep, genre) : null;
  const same = oldFeel ? pool.filter((t) => feelOf(t, rep[t.id], genre) === oldFeel) : [];
  const from = same.length ? same : pool;
  const t = from[Math.floor(makeRng(ctx.seed ?? 1)() * from.length)];
  const f = feelOf(t, rep[t.id], genre);
  const item: SetItem = { songId: t.id, title: t.title, feel: rep[t.id]?.feel || feelLabel(f, genre), minutes: minutesForFeel(f, rules, setList.setting) };
  if (t.artist) item.artist = t.artist;
  if (rep[t.id]?.key) item.key = String(rep[t.id]?.key).trim();
  return item;
}
