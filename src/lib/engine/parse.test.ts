import { describe, expect, it } from "vitest";
import { describeRequest, parseDate, parseGigRequest, planShape, DEFAULT_RULES, defaultRules, autoName } from "./index";
import { JAZZ, ROCK, song } from "./test-fixtures";

const TODAY = "2026-09-29"; // a Tuesday
const p = (text: string, genre = JAZZ, base = {}) => parseGigRequest(text, genre, base, { today: TODAY }).request;

describe("parseGigRequest", () => {
  it("reads hours, day and styles", () => {
    const r = p("2 hour gig Friday night, ballads and songbook standards");
    expect(r.hours).toBe(2);
    expect(r.styles).toEqual(expect.arrayContaining(["bl", "sb"]));
    expect(r.styles).toHaveLength(2);
    expect(r.date).toBe("2026-10-02");
    expect(r.setting).toBe("standard");
    expect(r.allowShaky).toBe(true);
  });

  it("reads '3 x 45'", () => {
    const r = p("Gypsy jazz gig Saturday, 3 x 45");
    expect(r.sets).toBe(3);
    expect(r.setMinutes).toBe(45);
    expect(r.styles).toEqual(["gy"]);
    expect(r.date).toBe("2026-10-03");
  });

  it("cocktail hour = 1 hour background, and 'at a wedding' is not a venue", () => {
    const r = p("1 hour cocktail hour at a wedding, bossa and swing");
    expect(r.hours).toBe(1);
    expect(r.setting).toBe("background");
    expect(r.styles).toEqual(["sw", "la"]);
    expect(r.venue).toBeUndefined();
    const r2 = p("cocktail hour");
    expect(r2.hours).toBe(1);
    expect(r2.setting).toBe("background");
  });

  it("jam session with a tune count", () => {
    const r = p("Jam session tonight, 8 tunes, bebop and hard bop");
    expect(r.count).toBe(8);
    expect(r.setting).toBe("jam");
    expect(r.date).toBe(TODAY);
    expect(r.styles).toEqual(expect.arrayContaining(["bp", "hb"]));
  });

  it("'hard bop' alone doesn't also mean bebop", () => {
    expect(p("hard bop night").styles).toEqual(["hb"]);
  });

  it("half hours and minute-based durations", () => {
    expect(p("an hour and a half of swing").hours).toBe(1.5);
    expect(p("1 and a half hours").hours).toBe(1.5);
    expect(p("half an hour of ballads").hours).toBe(0.5);
    expect(p("90 minutes of bossa").hours).toBe(1.5);
    const one = p("a 45 minute set");
    expect(one.sets).toBe(1);
    expect(one.setMinutes).toBe(45);
    const two = p("two 45 minute sets");
    expect(two.sets).toBe(2);
    expect(two.setMinutes).toBe(45);
    const of = p("3 sets of 40");
    expect(of.sets).toBe(3);
    expect(of.setMinutes).toBe(40);
  });

  it("relative dates", () => {
    expect(p("tomorrow").date).toBe("2026-09-30");
    expect(p("next Saturday").date).toBe("2026-10-03");
    expect(p("Tuesday").date).toBe(TODAY); // said on a Tuesday = today
    expect(p("next tuesday").date).toBe("2026-10-06");
    expect(parseDate(" october 12 ", TODAY)).toBe("2026-10-12");
    expect(parseDate(" 3rd of march ", TODAY)).toBe("2027-03-03");
    expect(parseDate(" 2026-12-31 ", TODAY)).toBe("2026-12-31");
  });

  it("venue, no-shaky, settings", () => {
    const r = parseGigRequest("Gig @ The Blue Note Friday, no shaky tunes", JAZZ, {}, { today: TODAY }).request;
    expect(r.venue).toBe("Blue Note");
    expect(r.allowShaky).toBe(false);
    expect(p("dinner at Luigi's").venue).toBe("Luigi's");
    expect(p("swing dance saturday").setting).toBe("dance");
    expect(p("listening room concert").setting).toBe("listening");
  });

  it("non-jazz: decades, favourites, tempo leanings, dance floor", () => {
    const r = p("2 hours of 80s rock", ROCK);
    expect(r.hours).toBe(2);
    expect(r.decades).toEqual(["1980"]);
    expect(p("sixties and 1970s and 2000s", ROCK).decades).toEqual(["1960", "1970", "2000"]);
    expect(p("oldies night", ROCK).decades).toEqual(["1950", "1960"]);
    const fav = p("3 hour bar gig Saturday night, classic rock crowd favourites", ROCK);
    expect(fav.favourites).toBe(true);
    expect(fav.styles).toContain("cr");
    const wed = p("Wedding reception, 3 x 45, party singalongs", ROCK);
    expect(wed.setting).toBe("dance");
    expect(wed.styles).toContain("pa");
    expect(p("slow songs, dinner", ROCK).setting).toBe("background");
  });

  it("jazz ignores decades but understands crowd favourites", () => {
    const r = p("80s night, crowd favourites");
    expect(r.decades).toBeUndefined();
    expect(r.favourites).toBe(true);
  });

  it("base values survive unless the text overrides them", () => {
    const r = p("2 hours", JAZZ, { picks: ["a", "b"], keepOrder: true, setting: "listening", count: 5 });
    expect(r.picks).toEqual(["a", "b"]);
    expect(r.setting).toBe("listening");
    expect(r.hours).toBe(2);
    expect(r.count).toBeUndefined(); // duration in the text replaces the old count
  });

  it("books and exclusions", () => {
    const songs = [song(JAZZ, "Autumn Leaves", ["sb"]), song(JAZZ, "Misty", ["bl"])];
    const books = [{ id: "b1", genre: "jazz" as const, name: "Trio book", ids: [] }];
    const r = parseGigRequest("2 hours from the trio book, no autumn leaves and without Misty", JAZZ, {}, { today: TODAY, songs, books });
    expect(r.request.bookId).toBe("b1");
    expect((r.request as { exclude?: string[] }).exclude).toEqual([songs[0].id, songs[1].id]);
    expect(r.summary).toContain("Trio book");
  });

  it("summary", () => {
    const { summary } = parseGigRequest("2 hour gig Friday night, ballads and songbook standards", JAZZ, {}, { today: TODAY });
    expect(summary).toBe("2 sets × 55 min · Songbook standards + Ballad · Standard gig · Fri, Oct 2");
  });
});

describe("describeRequest / autoName", () => {
  it("counts and tempo leanings", () => {
    const s = describeRequest({ styles: ["cr", "up"], count: 10, setting: "dance", allowShaky: false, favourites: true, decades: ["1980"] }, ROCK);
    expect(s).toBe("10 songs · Classic rock · Dance · '80s · leaning up-tempo · crowd favourites · no shaky songs");
  });
  it("names", () => {
    expect(autoName({ styles: ["bl", "sb"], setting: "standard", allowShaky: true, date: "2026-10-02" }, JAZZ)).toBe("Friday Ballads & Standards Gig");
    expect(autoName({ styles: ["cr", "up"], setting: "standard", allowShaky: true, decades: ["1980"], count: 8 }, ROCK)).toBe("'80s Classic rock Songs");
  });
});

describe("planShape", () => {
  const base = { styles: [], setting: "standard" as const, allowShaky: true };
  it("counts sets from hours and subtracts breaks", () => {
    expect(planShape({ ...base }, DEFAULT_RULES)).toEqual({ sets: 2, minutesPerSet: 55, totalMinutes: 120 });
    expect(planShape({ ...base, hours: 1 }, DEFAULT_RULES)).toMatchObject({ sets: 1, minutesPerSet: 60 });
    expect(planShape({ ...base, hours: 1.25 }, DEFAULT_RULES)).toMatchObject({ sets: 1, minutesPerSet: 75 });
    expect(planShape({ ...base, hours: 2.5 }, DEFAULT_RULES)).toMatchObject({ sets: 3, minutesPerSet: 43 });
    expect(planShape({ ...base, hours: 3 }, DEFAULT_RULES)).toMatchObject({ sets: 3, minutesPerSet: 53 });
    expect(planShape({ ...base, hours: 5 }, DEFAULT_RULES)).toMatchObject({ sets: 4, minutesPerSet: 68 });
    expect(planShape({ ...base, hours: 2 }, { ...DEFAULT_RULES, breakMin: 20 })).toMatchObject({ sets: 2, minutesPerSet: 50 });
  });
  it("explicit sets / set minutes", () => {
    expect(planShape({ ...base, sets: 3, setMinutes: 45 }, DEFAULT_RULES)).toEqual({ sets: 3, minutesPerSet: 45, totalMinutes: 155 });
    expect(planShape({ ...base, hours: 3, setMinutes: 45 }, DEFAULT_RULES)).toMatchObject({ sets: 3, minutesPerSet: 45 });
    expect(planShape({ ...base, sets: 2 }, DEFAULT_RULES)).toMatchObject({ sets: 2, minutesPerSet: 55 });
  });
  it("song counts", () => {
    expect(planShape({ ...base, count: 8 }, DEFAULT_RULES)).toEqual({ sets: 1, minutesPerSet: 0, totalMinutes: 0, count: 8 });
  });
  it("non-jazz defaults", () => {
    const r = defaultRules(ROCK);
    expect(r.minMedium).toBe(3.75);
    expect(r.facJam).toBe(130);
    expect(defaultRules(JAZZ)).toEqual(DEFAULT_RULES);
  });
});
