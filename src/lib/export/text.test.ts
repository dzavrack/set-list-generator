import { describe, expect, it } from "vitest";
import { FIXTURE_SET_LIST as SL, FIXTURE_SONGS } from "./fixture";
import {
  TEXT_FORMATS,
  exportFileName,
  formatDuration,
  formatGigDate,
  formatSetList,
  setListTotals,
  slugify,
} from "./text";

describe("helpers", () => {
  it("formats dates without timezone drift", () => {
    expect(formatGigDate("2026-10-03")).toBe("Saturday, October 3, 2026");
    expect(formatGigDate("2026-10-03", "short")).toBe("Sat, Oct 3, 2026");
    expect(formatGigDate(undefined)).toBe("");
    expect(formatGigDate("next friday")).toBe("next friday");
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(135)).toBe("2h 15m");
    expect(formatDuration(62.4)).toBe("1h 02m");
  });

  it("totals and file names", () => {
    expect(setListTotals(SL)).toEqual({ sets: 2, songs: 13, minutes: 79 });
    expect(slugify("Café Noir & Bar!")).toBe("cafe-noir-and-bar");
    expect(exportFileName(SL, "pdf")).toBe("2026-10-03-blue-note-set-list.pdf");
    expect(exportFileName({ ...SL, date: undefined, venue: undefined }, "txt")).toBe("blue-note-late-show-set-list.txt");
  });

  it("has metadata for every format", () => {
    expect(TEXT_FORMATS.map((f) => f.value)).toEqual(["stage", "bandleader", "titles", "numbered", "markdown"]);
    for (const f of TEXT_FORMATS) expect(f.label && f.description).toBeTruthy();
  });
});

describe("formatSetList", () => {
  it("stage: uppercase titles grouped by set", () => {
    const out = formatSetList(SL, "stage");
    expect(out).toContain("BLUE NOTE LATE SHOW — SAT, OCT 3, 2026 — BLUE NOTE");
    expect(out).toContain("=== SET 1 ===\n\nAUTUMN LEAVES\nSTELLA BY STARLIGHT");
    expect(out).toContain("=== BACKUPS ===");
    expect(out).not.toContain("Gm");
    expect(out).not.toMatch(/\n\n\n/);
  });

  it("bandleader: keys, feels, minutes, flags, set and total times", () => {
    const out = formatSetList(SL, "bandleader", { songs: FIXTURE_SONGS, includeNotes: true });
    expect(out.split("\n")[0]).toBe("Blue Note Late Show");
    expect(out).toContain("Saturday, October 3, 2026 · Blue Note");
    expect(out).toContain("SET 1 · 7 songs · 42 min");
    expect(out).toContain("SET 2 · 6 songs · 37 min");
    expect(out).toContain("TOTAL: 2 sets · 13 songs · 1h 19m of music");
    const stella = out.split("\n").find((l) => l.includes("Stella by Starlight"))!;
    expect(stella).toMatch(/Bb\s+Ballad\s+7'\s+@0:06\s+\[shaky\]/);
    expect(out).toContain("(Joseph Kosma, 1945)");
    expect(out).toContain("↳ Intro vamp, 8 bars");
    expect(out).toContain("- Set 2 runs 3 min short");
    // numbered straight through the night, not restarting at each set
    expect(out).toMatch(/\n 8\.\s+So What/);
    expect(out).toMatch(/\n13\.\s+'Round Midnight/);
  });

  it("bandleader: never truncates a long title", () => {
    const long = "Indiana (Back Home Again in Indiana) — the long version";
    const sets = SL.sets.map((s, i) => (i === 0 ? { ...s, items: [{ ...s.items[0], title: long }, ...s.items.slice(1)] } : s));
    const out = formatSetList({ ...SL, sets }, "bandleader");
    expect(out).toContain(long);
    expect(out).not.toContain("…");
  });

  it("titles: plain lines, blank line between sets, no headings", () => {
    const out = formatSetList(SL, "titles", { includeBackups: false });
    expect(out.startsWith("Autumn Leaves\nStella by Starlight")).toBe(true);
    expect(out).toContain("Take the A Train\n\nSo What");
    expect(out).not.toContain("Set 1");
    expect(out).not.toContain("Misty");
  });

  it("numbered: continuous numbering across sets", () => {
    const out = formatSetList(SL, "numbered");
    expect(out).toContain(" 7. Take the A Train\n\nSet 2\n 8. So What");
    expect(out).toContain("13. 'Round Midnight");
    expect(out).toContain("Backups\n  - Misty");
  });

  it("markdown: numbering runs on across sets", () => {
    const out = formatSetList(SL, "markdown");
    expect(out).toContain("## Set 2 · 37 min\n\n8. **So What**");
  });

  it("markdown: headed and escaped", () => {
    const out = formatSetList({ ...SL, name: "Gig #1" }, "markdown", { songs: FIXTURE_SONGS, includeNotes: true });
    expect(out.startsWith("# Gig \\#1\n")).toBe(true);
    expect(out).toContain("**Saturday, October 3, 2026 · Blue Note**");
    expect(out).toContain("## Set 1 · 42 min");
    expect(out).toContain("1. **Autumn Leaves** _(Joseph Kosma, 1945)_ — Gm · Medium swing · 6 min");
    expect(out).toContain("2. **Stella by Starlight** — Bb · Ballad · 7 min `shaky`");
    expect(out).toContain("## Backups\n\n- **Misty**");
    expect(out).toContain("## Notes\n\n- Set 2 runs 3 min short");
  });

  it("handles an empty set list", () => {
    const empty = { ...SL, name: "", date: undefined, venue: undefined, sets: [], backups: [], notes: [] };
    for (const f of TEXT_FORMATS) expect(() => formatSetList(empty, f.value)).not.toThrow();
    expect(formatSetList(empty, "titles")).toBe("\n");
  });
});
