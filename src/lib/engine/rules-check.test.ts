import { describe, expect, it } from "vitest";
import type { GigSet, Rules, SetList } from "../types";
import { checkSet, checkSetList, DEFAULT_RULES, JAZZ_ONLY_RULES, mergeRules, RULE_GROUPS, type RuleDef } from "./index";
import { JAZZ, ROCK } from "./test-fixtures";

const keysIn = (defs: RuleDef[]) => defs.filter((d) => d.kind !== "fixed").map((d) => (d as { key: keyof Rules }).key);
const allText = (genre = JAZZ) =>
  RULE_GROUPS(genre).flatMap((g) => [g.title, g.blurb, ...g.rules.map((r) => (r.kind === "fixed" ? r.text : r.kind === "number" ? `${r.label} ${r.before} ${r.after} ${r.help ?? ""}` : `${r.label} ${r.help ?? ""}`))]).join("\n");

describe("RULE_GROUPS", () => {
  it("jazz covers every rule exactly once", () => {
    const keys = RULE_GROUPS(JAZZ).flatMap((g) => keysIn(g.rules));
    expect(keys.slice().sort()).toEqual((Object.keys(DEFAULT_RULES) as (keyof Rules)[]).sort());
    expect(RULE_GROUPS(JAZZ).map((g) => g.id)).toEqual(["lengths", "rooms", "shape", "picking", "flow", "ends"]);
  });

  it("0/1 rules are toggles, the rest numbers with sane ranges", () => {
    for (const g of RULE_GROUPS(JAZZ)) {
      for (const r of g.rules) {
        if (r.kind === "toggle") expect(["shakyOnlyIfShort", "popularBoost"]).toContain(r.key);
        if (r.kind === "number") {
          expect(r.min).toBeLessThanOrEqual(DEFAULT_RULES[r.key]);
          expect(r.max).toBeGreaterThanOrEqual(DEFAULT_RULES[r.key]);
          expect(r.step).toBeGreaterThan(0);
        }
      }
    }
  });

  it("non-jazz drops jazz-only rules, says 'song', adds Decades", () => {
    const groups = RULE_GROUPS(ROCK);
    const keys = groups.flatMap((g) => keysIn(g.rules));
    for (const k of JAZZ_ONLY_RULES) expect(keys).not.toContain(k);
    expect(keys).toHaveLength(Object.keys(DEFAULT_RULES).length - JAZZ_ONLY_RULES.length);
    const text = allText(ROCK);
    expect(text).not.toMatch(/\btunes?\b|ballad|bossa|Cherokee|Latin|waltz|two-beat|modal/i);
    expect(text).toMatch(/slow songs/);
    expect(groups.map((g) => g.id)).toContain("decades");
    expect(groups.find((g) => g.id === "decades")!.rules.every((r) => r.kind === "fixed")).toBe(true);
    expect(allText(JAZZ)).toMatch(/Cherokee/);
  });

  it("mergeRules keeps old saved values and ignores junk", () => {
    const r = mergeRules(ROCK, { minBallad: 4.5, breakMin: "x" as unknown as number });
    expect(r.minBallad).toBe(4.5);
    expect(r.breakMin).toBe(10);
    expect(r.minMedium).toBe(3.75);
  });
});

const it_ = (songId: string, feel: string, extra: Partial<GigSet["items"][number]> = {}) => ({ songId, title: songId, feel, minutes: 5, ...extra });

describe("checkSet", () => {
  const ctx = { rules: DEFAULT_RULES, genre: JAZZ };

  it("a clean set has no warnings", () => {
    const set: GigSet = { name: "Set 1", items: [it_("a", "Medium swing", { key: "F" }), it_("b", "Ballad", { key: "Eb" }), it_("c", "Bossa / Latin", { key: "F" }), it_("d", "Medium swing"), it_("e", "Up-tempo swing")] };
    expect(checkSet(set, ctx)).toEqual([]);
  });

  it("flags shaky openers, closers and second songs", () => {
    const sh = { flags: ["shaky" as const] };
    const set: GigSet = { name: "Set 1", items: [it_("a", "Medium swing", sh), it_("b", "Medium swing", sh), it_("c", "Medium swing"), it_("d", "Medium swing", sh)] };
    const rules = checkSet(set, ctx).map((w) => w.rule);
    expect(rules).toEqual(expect.arrayContaining(["shaky-opener", "shaky-second", "shaky-closer", "too-many-shaky"]));
    // Shaky status can also come from the repertoire
    const r2 = checkSet({ name: "S", items: [it_("x", "Medium swing"), it_("y", "Medium swing")] }, { ...ctx, rep: { x: { status: "shaky" } } });
    expect(r2.map((w) => w.rule)).toEqual(["shaky-opener"]);
  });

  it("flags ballads in a row, same key, same feel and duplicates", () => {
    const set: GigSet = {
      name: "Set 2",
      items: [
        it_("a", "Medium swing", { key: "Bb" }), it_("b", "Ballad"), it_("c", "Ballad"),
        it_("d", "Bossa / Latin", { key: "C" }), it_("e", "Bossa / Latin", { key: "c major" }), it_("f", "Bossa / Latin"),
        it_("a", "Medium swing"),
      ],
    };
    const w = checkSet(set, { ...ctx, setIndex: 1 });
    expect(w.find((x) => x.rule === "ballads-in-a-row")).toMatchObject({ setIndex: 1, itemIndex: 2 });
    expect(w.find((x) => x.rule === "same-key")).toMatchObject({ itemIndex: 4 });
    expect(w.find((x) => x.rule === "same-feel-row")).toMatchObject({ itemIndex: 5 });
    expect(w.find((x) => x.rule === "duplicate")).toMatchObject({ itemIndex: 6 });
    // ballad-heavy gigs allow two in a row
    expect(checkSet(set, { ...ctx, balladHeavy: true }).some((x) => x.rule === "ballads-in-a-row")).toBe(false);
  });

  it("feels fall back to the song's tags when an item has no feel", () => {
    const songs = [{ id: "s1", genre: "jazz" as const, title: "S1", rank: 1, styles: ["bl"] }, { id: "s2", genre: "jazz" as const, title: "S2", rank: 2, styles: ["bl"] }];
    const set: GigSet = { name: "S", items: [it_("m", "Medium swing"), { songId: "s1", title: "S1", minutes: 5 }, { songId: "s2", title: "S2", minutes: 5 }, it_("n", "Medium swing")] };
    expect(checkSet(set, { ...ctx, songs }).map((w) => w.rule)).toEqual(["ballads-in-a-row"]);
  });

  it("background sets go easy on up-tempo; non-jazz wording", () => {
    const set: GigSet = { name: "S", items: [it_("a", "Mid-tempo"), it_("b", "Up-tempo"), it_("c", "Mid-tempo"), it_("d", "Up-tempo")] };
    const w = checkSet(set, { rules: DEFAULT_RULES, genre: ROCK, setting: "background" });
    expect(w.map((x) => x.rule)).toEqual(["up-tempo-background"]);
    expect(w[0].message).toMatch(/2 up-tempo songs/);
    const b = checkSet({ name: "S", items: [it_("a", "Slow / ballad"), it_("b", "Mid-tempo"), it_("c", "Up-tempo")] }, { rules: DEFAULT_RULES, genre: ROCK });
    expect(b[0].message).toMatch(/slow song/);
  });

  it("checkSetList finds songs repeated across sets", () => {
    const sl: SetList = {
      id: "x", genre: "jazz", name: "n", setting: "standard", createdAt: "", updatedAt: "", backups: [], notes: [],
      sets: [{ name: "Set 1", items: [it_("a", "Medium swing"), it_("b", "Medium swing")] }, { name: "Set 2", items: [it_("c", "Medium swing"), it_("a", "Medium swing")] }],
    };
    expect(checkSetList(sl, ctx)).toEqual([{ setIndex: 1, itemIndex: 1, rule: "duplicate", message: "“a” is also in Set 1." }]);
  });
});
