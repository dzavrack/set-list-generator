import { describe, expect, it } from "vitest";
import type { GigRequest, Repertoire, SetList, Song } from "../types";
import { buildSetList, checkSet, DEFAULT_RULES, defaultRules, feelOf, minutesFor, retime, setMinutes, feelLabel } from "./index";
import { JAZZ, ROCK, jazzLibrary, song } from "./test-fixtures";

const req = (r: Partial<GigRequest> = {}): GigRequest => ({ styles: [], setting: "standard", allowShaky: true, ...r });
const knowAll = (songs: Song[], extra: Repertoire = {}): Repertoire => {
  const rep: Repertoire = {};
  for (const s of songs) rep[s.id] = { status: "know" };
  return { ...rep, ...extra };
};
const ids = (sl: SetList) => sl.sets.flatMap((s) => s.items.map((i) => i.songId));
const items = (sl: SetList) => sl.sets.flatMap((s) => s.items);
const NOW = "2026-09-29T20:00:00.000Z";

describe("feelOf / minutesFor", () => {
  it("jazz feels from tags and the player's own setting", () => {
    expect(feelOf(song(JAZZ, "B", ["sb", "bl"]), undefined, JAZZ)).toBe("ballad");
    expect(feelOf(song(JAZZ, "Cherokee", ["sw", "la"], { id: "cherokee" }), undefined, JAZZ)).toBe("up");
    expect(feelOf(song(JAZZ, "Bossa", ["la"]), undefined, JAZZ)).toBe("latin");
    expect(feelOf(song(JAZZ, "Swing w/ latin tag", ["sw", "la"]), undefined, JAZZ)).toBe("medium");
    expect(feelOf(song(JAZZ, "Blues", ["bu"]), undefined, JAZZ)).toBe("blues");
    expect(feelOf(song(JAZZ, "Trad", ["tr"]), undefined, JAZZ)).toBe("two");
    expect(feelOf(song(JAZZ, "Modal", ["md"]), undefined, JAZZ)).toBe("modal");
    expect(feelOf(song(JAZZ, "Waltz", ["wz", "sb"]), undefined, JAZZ)).toBe("waltz");
    expect(feelOf(song(JAZZ, "Any", ["sb"]), { status: "know", feel: "Jazz waltz" }, JAZZ)).toBe("waltz");
    expect(feelOf(song(JAZZ, "Any", ["sb"]), { status: "know", styles: ["bl"] }, JAZZ)).toBe("ballad");
  });
  it("non-jazz has three feels", () => {
    expect(feelOf(song(ROCK, "S", ["cr", "bl"]), undefined, ROCK)).toBe("ballad");
    expect(feelOf(song(ROCK, "U", ["cr", "up"]), undefined, ROCK)).toBe("up");
    expect(feelOf(song(ROCK, "M", ["cr"]), { status: "know", feel: "Bossa / Latin" }, ROCK)).toBe("medium");
    expect(feelLabel("latin", ROCK)).toBe("Mid-tempo");
    expect(feelLabel("up", JAZZ)).toBe("Up-tempo swing");
  });
  it("minutes follow the rules and the room", () => {
    const s = song(JAZZ, "Std", ["sb"]);
    expect(minutesFor(s, undefined, JAZZ, DEFAULT_RULES, "standard")).toBe(6);
    expect(minutesFor(s, undefined, JAZZ, DEFAULT_RULES, "background")).toBe(5.1);
    expect(minutesFor(s, undefined, JAZZ, DEFAULT_RULES, "jam")).toBe(7.5);
    expect(minutesFor(song(ROCK, "R", ["cr"]), undefined, ROCK, defaultRules(ROCK), "standard")).toBe(3.75);
  });
});

describe("buildSetList", () => {
  const lib = jazzLibrary();
  const rep = knowAll(lib);
  const build = (r: Partial<GigRequest>, extra: Partial<Parameters<typeof buildSetList>[0]> = {}) =>
    buildSetList({ request: req(r), songs: lib, rep, rules: DEFAULT_RULES, genre: JAZZ, seed: 7, now: NOW, ...extra });

  it("is deterministic by seed", () => {
    const a = build({ hours: 2 });
    const b = build({ hours: 2 });
    expect(b).toEqual(a);
    const others = [1, 2, 3, 4, 5].map((seed) => ids(build({ hours: 2 }, { seed })).join());
    expect(new Set(others).size).toBeGreaterThan(1);
    expect(a.id).toBe(build({ hours: 2 }).id);
    expect(a.id).not.toBe(build({ hours: 2 }, { seed: 8 }).id);
    expect(a.createdAt).toBe(NOW);
    expect(a.genre).toBe("jazz");
  });

  it("counts sets from hours and fills each set close to its length", () => {
    const sl = build({ hours: 2 });
    expect(sl.sets.map((s) => s.name)).toEqual(["Set 1", "Set 2"]);
    for (const s of sl.sets) expect(Math.abs(setMinutes(s) - 55)).toBeLessThanOrEqual(6);
    const three = build({ hours: 3 });
    expect(three.sets).toHaveLength(3);
    const x = build({ sets: 3, setMinutes: 45 });
    expect(x.sets).toHaveLength(3);
    for (const s of x.sets) expect(Math.abs(setMinutes(s) - 45)).toBeLessThanOrEqual(6);
  });

  it("break length changes how much music fits", () => {
    const short = buildSetList({ request: req({ hours: 2 }), songs: lib, rep, rules: { ...DEFAULT_RULES, breakMin: 30 }, genre: JAZZ, seed: 7 });
    const long = build({ hours: 2 });
    expect(items(short).length).toBeLessThan(items(long).length);
  });

  it("song counts make one set", () => {
    const sl = build({ count: 8 });
    expect(sl.sets).toHaveLength(1);
    expect(sl.sets[0].name).toBe("Tunes");
    expect(sl.sets[0].items).toHaveLength(8);
  });

  it("never repeats a song", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const sl = build({ hours: 4 }, { seed });
      const all = ids(sl).concat(sl.backups.map((b) => b.songId));
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("opens and closes strong", () => {
    const shakyLib = lib.slice();
    const rep2 = knowAll(shakyLib);
    for (const s of shakyLib.slice(0, 8)) rep2[s.id] = { status: "shaky" };
    for (let seed = 1; seed <= 15; seed++) {
      const sl = buildSetList({ request: req({ hours: 2 }), songs: shakyLib, rep: rep2, rules: { ...DEFAULT_RULES, shakyOnlyIfShort: 0 }, genre: JAZZ, seed });
      for (const s of sl.sets) {
        const first = s.items[0], last = s.items[s.items.length - 1];
        expect(first.flags ?? []).not.toContain("shaky");
        expect(last.flags ?? []).not.toContain("shaky");
        expect(s.items[1].flags ?? []).not.toContain("shaky");
        expect(first.feel).not.toBe("Ballad");
        expect(last.feel).not.toBe("Ballad");
      }
    }
  });

  it("closes on an up-tempo tune when there is one", () => {
    const withUp = lib.concat([song(JAZZ, "Cherokee", ["sw"], { id: "cherokee" })]);
    const picks = [lib[0].id, lib[1].id, "cherokee", lib[2].id, lib[3].id];
    for (let seed = 1; seed <= 5; seed++) {
      const sl = buildSetList({ request: req({ count: 5, picks }), songs: withUp, rep: knowAll(withUp), rules: DEFAULT_RULES, genre: JAZZ, seed });
      expect(sl.sets[0].items[4].songId).toBe("cherokee");
    }
  });

  describe("shaky rules", () => {
    const small = jazzLibrary({ standards: 6, ballads: 2, latin: 1 });
    const repS = knowAll(small);
    const extra = Array.from({ length: 8 }, (_, i) => song(JAZZ, `Shaky ${i + 1}`, ["sb"]));
    extra.forEach((s) => (repS[s.id] = { status: "shaky" }));
    const all = small.concat(extra);

    it("skips Shaky songs when there are enough Know-it ones", () => {
      const sl = build({ hours: 1 });
      expect(items(sl).some((i) => i.flags?.includes("shaky"))).toBe(false);
      const sl2 = buildSetList({ request: req({ hours: 1 }), songs: lib.concat(extra), rep: { ...rep, ...repS }, rules: DEFAULT_RULES, genre: JAZZ, seed: 2 });
      expect(items(sl2).some((i) => i.flags?.includes("shaky"))).toBe(false);
    });

    it("fills with Shaky songs when short, capped per set, with a note", () => {
      const sl = buildSetList({ request: req({ hours: 2 }), songs: all, rep: repS, rules: DEFAULT_RULES, genre: JAZZ, seed: 2 });
      for (const s of sl.sets) expect(s.items.filter((i) => i.flags?.includes("shaky")).length).toBeLessThanOrEqual(2);
      const n = items(sl).filter((i) => i.flags?.includes("shaky")).length;
      expect(n).toBe(4);
      expect(sl.notes.join(" ")).toMatch(/4 Shaky tunes included to fill time/);
      expect(sl.notes.join(" ")).toMatch(/runs shorter|only have/);
    });

    it("no Shaky songs when not allowed", () => {
      const sl = buildSetList({ request: req({ hours: 2, allowShaky: false }), songs: all, rep: repS, rules: DEFAULT_RULES, genre: JAZZ, seed: 2 });
      expect(items(sl).some((i) => i.flags?.includes("shaky"))).toBe(false);
      expect(items(sl)).toHaveLength(9);
      expect(sl.notes[0]).toMatch(/only have 9 tunes/);
    });

    it("mixes Shaky songs in when 'only if short' is off", () => {
      const sl = buildSetList({ request: req({ hours: 2 }), songs: lib.concat(extra), rep: { ...rep, ...repS }, rules: { ...DEFAULT_RULES, shakyOnlyIfShort: 0 }, genre: JAZZ, seed: 2 });
      const per = sl.sets.map((s) => s.items.filter((i) => i.flags?.includes("shaky")).length);
      expect(per.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
      for (const n of per) expect(n).toBeLessThanOrEqual(2);
    });
  });

  it("paces ballads: about 20%, never two in a row", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const sl = build({ hours: 3 }, { seed });
      const all = items(sl);
      const b = all.filter((i) => i.feel === "Ballad").length;
      expect(b).toBeGreaterThanOrEqual(Math.round(all.length * 0.2) - 1);
      expect(b).toBeLessThanOrEqual(Math.round(all.length * 0.3));
      for (const s of sl.sets) {
        for (let i = 1; i < s.items.length; i++) expect(s.items[i].feel === "Ballad" && s.items[i - 1].feel === "Ballad").toBe(false);
      }
    }
  });

  it("ballad gigs are ballad-heavy but still paced", () => {
    const sl = build({ hours: 2, styles: ["bl", "sb"] });
    const all = items(sl);
    const b = all.filter((i) => i.feel === "Ballad").length;
    expect(b / all.length).toBeGreaterThanOrEqual(0.4);
    for (const s of sl.sets) {
      let run = 0;
      for (const it of s.items) { run = it.feel === "Ballad" ? run + 1 : 0; expect(run).toBeLessThanOrEqual(2); }
    }
  });

  it("keeps a Latin tune about every 5 in a mixed jazz gig", () => {
    const sl = build({ hours: 2 });
    const all = items(sl);
    expect(all.filter((i) => i.feel === "Bossa / Latin").length).toBeGreaterThanOrEqual(Math.floor(all.length / 5));
  });

  it("plays Latin-tagged standards as a bossa when short of Latin tunes", () => {
    const l = jazzLibrary({ latin: 0 }).concat(Array.from({ length: 6 }, (_, i) => song(JAZZ, `Swing bossa ${i}`, ["sw", "la"])));
    const sl = buildSetList({ request: req({ hours: 2 }), songs: l, rep: knowAll(l), rules: DEFAULT_RULES, genre: JAZZ, seed: 4 });
    const converted = items(sl).filter((i) => i.note === "Try it with a Latin/bossa feel");
    expect(converted.length).toBeGreaterThan(0);
    expect(converted.every((i) => i.feel === "Bossa / Latin")).toBe(true);
  });

  it("keeps up-tempo tunes down at background gigs", () => {
    const ups = Array.from({ length: 10 }, (_, i) => song(JAZZ, `Burner ${i}`, ["sb"]));
    const l = lib.concat(ups);
    const r = knowAll(l);
    ups.forEach((s) => (r[s.id] = { status: "know", feel: "Up-tempo swing" }));
    const sl = buildSetList({ request: req({ hours: 2, setting: "background" }), songs: l, rep: r, rules: DEFAULT_RULES, genre: JAZZ, seed: 5 });
    expect(items(sl).filter((i) => i.feel === "Up-tempo swing").length).toBeLessThanOrEqual(2);
  });

  it("keeps same keys apart", () => {
    const keys = ["C", "F", "Bb"];
    const l = Array.from({ length: 9 }, (_, i) => song(JAZZ, `Keyed ${i}`, ["sb"]));
    const r = knowAll(l);
    l.forEach((s, i) => (r[s.id] = { status: "know", key: keys[i % 3] + (i % 2 ? " major" : "") }));
    for (let seed = 1; seed <= 20; seed++) {
      const sl = buildSetList({ request: req({ count: 9 }), songs: l, rep: r, rules: { ...DEFAULT_RULES, latinEvery: 100 }, genre: JAZZ, seed });
      const warnings = checkSet(sl.sets[0], { rules: DEFAULT_RULES, genre: JAZZ, songs: l, rep: r });
      expect(warnings.filter((w) => w.rule === "same-key")).toEqual([]);
    }
  });

  it("borrows from neighbouring styles when short, and says so", () => {
    const l = jazzLibrary({ standards: 20, ballads: 4, latin: 2, gypsy: 3 }).concat(Array.from({ length: 5 }, (_, i) => song(JAZZ, `Bebop ${i}`, ["bp"])));
    const sl = buildSetList({ request: req({ hours: 1, styles: ["gy"] }), songs: l, rep: knowAll(l), rules: DEFAULT_RULES, genre: JAZZ, seed: 1 });
    const all = items(sl);
    const gypsy = all.filter((i) => i.title.startsWith("Gypsy"));
    expect(gypsy).toHaveLength(3);
    expect(gypsy.every((i) => !i.flags?.includes("other-style"))).toBe(true);
    const borrowed = all.filter((i) => i.flags?.includes("other-style"));
    expect(borrowed.length).toBe(all.length - 3);
    // gypsy's neighbours are swing and trad: Standards (sb+sw) qualify, bebop never does
    expect(borrowed.every((i) => i.title.startsWith("Standard"))).toBe(true);
    expect(sl.notes.join(" ")).toMatch(/neighbouring style/);
    expect(sl.backups).toEqual([]);
  });

  it("builds from picks in your order", () => {
    const picks = lib.slice(0, 14).map((s) => s.id).reverse();
    const r = { ...rep, [picks[3]]: { status: "shaky" as const } };
    const sl = buildSetList({ request: req({ hours: 1, picks, keepOrder: true }), songs: lib, rep: r, rules: DEFAULT_RULES, genre: JAZZ, seed: 9 });
    const used = ids(sl);
    expect(used).toEqual(picks.slice(0, used.length));
    expect(sl.backups.map((b) => b.songId)).toEqual(picks.slice(used.length));
    expect(items(sl).every((i) => i.flags?.includes("picked"))).toBe(true);
    expect(items(sl).find((i) => i.songId === picks[3])?.flags).toContain("shaky");
    expect(sl.notes.join(" ")).toMatch(/of your picked tunes didn't fit/);
    // any seed gives the same answer
    expect(ids(buildSetList({ request: req({ hours: 1, picks, keepOrder: true }), songs: lib, rep: r, rules: DEFAULT_RULES, genre: JAZZ, seed: 99 }))).toEqual(used);
  });

  it("picks without keepOrder only use picked songs", () => {
    const picks = lib.slice(0, 6).map((s) => s.id);
    const sl = build({ count: 6, picks });
    expect(ids(sl).sort()).toEqual(picks.slice().sort());
  });

  it("respects a book and exclusions", () => {
    const book = { id: "b", genre: "jazz" as const, name: "Trio", ids: lib.slice(0, 12).map((s) => s.id) };
    const sl = build({ count: 10, bookId: "b", ...({ exclude: [lib[0].id] } as object) }, { books: [book] });
    expect(ids(sl).every((id) => book.ids.includes(id))).toBe(true);
    expect(ids(sl)).not.toContain(lib[0].id);
  });

  it("ranks recently played songs lower", () => {
    const first = build({ count: 10 });
    let reused = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const next = build({ count: 10 }, { seed, recent: [first] });
      reused += ids(next).filter((id) => ids(first).includes(id)).length;
    }
    let reusedNoRecent = 0;
    for (let seed = 1; seed <= 10; seed++) reusedNoRecent += ids(build({ count: 10 }, { seed })).filter((id) => ids(first).includes(id)).length;
    expect(reused).toBeLessThan(reusedNoRecent);
  });

  it("adds backups and a name", () => {
    const sl = build({ hours: 1, styles: ["sb"], date: "2026-10-02" });
    expect(sl.backups).toHaveLength(3);
    expect(sl.name).toBe("Friday Standards Gig");
    expect(build({ hours: 1 }, { name: "Mine" }).name).toBe("Mine");
  });

  it("notes when a set runs well short", () => {
    const tiny = jazzLibrary({ standards: 4, ballads: 0, latin: 0 });
    const sl = buildSetList({ request: req({ hours: 1 }), songs: tiny, rep: knowAll(tiny), rules: DEFAULT_RULES, genre: JAZZ, seed: 1 });
    expect(sl.notes.join(" ")).toMatch(/Set 1 runs about 36 min short/);
  });
});

describe("non-jazz building", () => {
  const rules = defaultRules(ROCK);
  const songs: Song[] = [];
  for (let i = 0; i < 12; i++) songs.push(song(ROCK, `Eighties ${i}`, i % 4 === 0 ? ["ar", "bl"] : i % 3 === 0 ? ["ar", "up"] : ["ar"], { year: 1983, hit: i < 3 }));
  for (let i = 0; i < 12; i++) songs.push(song(ROCK, `Seventies ${i}`, ["cr"], { year: 1975 }));
  for (let i = 0; i < 4; i++) songs.push(song(ROCK, `Punk ${i}`, ["pk"], { year: 1983 }));
  const rep = knowAll(songs);

  it("uses the asked decade first and marks other decades", () => {
    const sl = buildSetList({ request: req({ count: 14, decades: ["1980"], styles: ["ar"] }), songs, rep, rules, genre: ROCK, seed: 1 });
    const all = items(sl);
    expect(all.filter((i) => i.title.startsWith("Eighties"))).toHaveLength(12);
    const other = all.filter((i) => i.flags?.includes("other-style"));
    expect(other).toHaveLength(2);
    expect(sl.notes.join(" ")).toMatch(/another decade/);
    expect(all[0].feel).toBe("Mid-tempo");
    expect(sl.sets[0].name).toBe("Songs");
  });

  it("tempo words lean the mix instead of filtering it", () => {
    const sl = buildSetList({ request: req({ count: 6, styles: ["up"] }), songs, rep, rules, genre: ROCK, seed: 1 });
    expect(items(sl)).toHaveLength(6);
    expect(items(sl).filter((i) => i.feel === "Up-tempo").length).toBeGreaterThanOrEqual(2);
    expect(items(sl).some((i) => i.flags?.includes("other-style"))).toBe(false);
  });

  it("minutes use the non-jazz lengths", () => {
    const sl = buildSetList({ request: req({ hours: 1 }), songs, rep, rules, genre: ROCK, seed: 1 });
    expect(Math.abs(setMinutes(sl.sets[0]) - 60)).toBeLessThanOrEqual(4);
    expect(items(sl).length).toBeGreaterThan(14);
  });
});

describe("retime", () => {
  it("recomputes minutes after feel edits and setting changes", () => {
    const lib = jazzLibrary({ standards: 6, ballads: 0, latin: 0 });
    const rep = knowAll(lib);
    const sl = buildSetList({ request: req({ count: 4 }), songs: lib, rep, rules: DEFAULT_RULES, genre: JAZZ, seed: 1 });
    expect(setMinutes(sl.sets[0])).toBe(24);
    const edited: SetList = { ...sl, sets: [{ ...sl.sets[0], items: sl.sets[0].items.map((it, i) => (i === 0 ? { ...it, feel: "Modal" } : it)) }] };
    expect(setMinutes(retime(edited, lib, rep, DEFAULT_RULES, JAZZ).sets[0])).toBe(25);
    const bg = retime({ ...sl, setting: "background" }, lib, rep, DEFAULT_RULES, JAZZ);
    expect(setMinutes(bg.sets[0])).toBe(20);
    expect(sl.sets[0].items[0].minutes).toBe(6); // input untouched
  });
});

describe("picks with a length", () => {
  const lib = jazzLibrary();
  const rep = knowAll(lib);
  it("puts the picks in first and fills the rest of the time with known songs", () => {
    const picks = lib.slice(0, 3).map((s) => s.id);
    const sl = buildSetList({ request: req({ hours: 1.5, sets: 2, picks }), songs: lib, rep, rules: DEFAULT_RULES, genre: JAZZ, seed: 4 });
    const used = ids(sl);
    expect(used.length).toBeGreaterThan(picks.length);
    for (const p of picks) expect(used).toContain(p);
    expect(items(sl).filter((i) => i.flags?.includes("picked")).map((i) => i.songId).sort()).toEqual([...picks].sort());
    expect(sl.notes.join(" ")).toMatch(/fill out the time/);
  });

  it("with no length, uses just the picks", () => {
    const picks = lib.slice(0, 4).map((s) => s.id);
    const sl = buildSetList({ request: { styles: [], setting: "standard", allowShaky: false, picks }, songs: lib, rep, rules: DEFAULT_RULES, genre: JAZZ, seed: 4 });
    expect(ids(sl).sort()).toEqual([...picks].sort());
    expect(sl.notes.join(" ")).not.toMatch(/short/);
  });
});
