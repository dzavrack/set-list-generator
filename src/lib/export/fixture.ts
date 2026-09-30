// Test fixture shared by the export tests.
import type { SetList, Song } from "../types";

const item = (songId: string, title: string, key: string, feel: string, minutes: number, extra: object = {}) => ({
  songId, title, key, feel, minutes, ...extra,
});

export const FIXTURE_SET_LIST: SetList = {
  id: "sl1",
  genre: "jazz",
  name: "Blue Note Late Show",
  date: "2026-10-03",
  venue: "Blue Note",
  setting: "listening",
  createdAt: "2026-09-29T12:00:00.000Z",
  updatedAt: "2026-09-29T12:00:00.000Z",
  sets: [
    {
      name: "Set 1",
      items: [
        item("autumn-leaves", "Autumn Leaves", "Gm", "Medium swing", 6),
        item("stella", "Stella by Starlight", "Bb", "Ballad", 7, { flags: ["shaky"] }),
        item("blue-bossa", "Blue Bossa", "Cm", "Bossa", 5),
        item("all-the-things", "All the Things You Are", "Ab", "Up swing", 6, { note: "Intro vamp, 8 bars" }),
        item("in-a-sentimental-mood", "In a Sentimental Mood", "Dm", "Ballad", 6),
        item("footprints", "Footprints", "Cm", "Modal", 7, { flags: ["other-style"] }),
        item("take-the-a-train", "Take the A Train", "C", "Up swing", 5),
      ],
    },
    {
      name: "Set 2",
      items: [
        item("so-what", "So What", "Dm", "Modal", 8),
        item("my-funny-valentine", "My Funny Valentine", "Cm", "Ballad", 6, { flags: ["picked"] }),
        item("girl-from-ipanema", "The Girl from Ipanema", "F", "Bossa", 5),
        item("someday-my-prince", "Someday My Prince Will Come", "Bb", "Waltz", 6),
        item("billies-bounce", "Billie's Bounce", "F", "Blues", 5),
        item("round-midnight", "'Round Midnight", "Ebm", "Ballad", 7),
      ],
    },
  ],
  backups: [
    item("misty", "Misty", "Eb", "Ballad", 5),
    item("oleo", "Oleo", "Bb", "Up swing", 4),
  ],
  notes: ["Set 2 runs 3 min short", "Two shaky tunes allowed"],
};

export const FIXTURE_SONGS = new Map<string, Song>([
  ["autumn-leaves", { id: "autumn-leaves", genre: "jazz", title: "Autumn Leaves", rank: 1, styles: [], composer: "Joseph Kosma", publishYear: 1945 }],
  ["so-what", { id: "so-what", genre: "jazz", title: "So What", rank: 5, styles: [], artist: "Miles Davis", year: 1959 }],
]);
