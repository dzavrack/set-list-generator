// Rule defaults and the metadata the Rules page renders.
import type { GenreConfig, Rules } from "../types";
import { isJazz, nouns } from "./util";

/** Jazz defaults (identical to the old app so saved rules/backups stay meaningful). */
export const DEFAULT_RULES: Rules = {
  minBallad: 5, minMedium: 6, minUp: 6, minLatin: 5.5, minWaltz: 5.5, minBlues: 6, minTwo: 5, minModal: 7,
  facBackground: 85, facListening: 115, facJam: 125, facDance: 90,
  breakMin: 10, defaultHours: 2,
  balladPct: 20, balladHeavyPct: 50, upMaxBackground: 1, maxBalladsRow: 1, maxBalladsRowHeavy: 2,
  latinEvery: 5, maxSameFeelRow: 2,
  shakyMaxPerSet: 2, shakyOnlyIfShort: 1,
  recentLists: 2, backups: 3, popularBoost: 1,
};

/** Non-jazz genres play shorter songs with fewer solos (old loadRules overrides). */
const NON_JAZZ_OVERRIDES: Partial<Rules> = {
  minBallad: 4, minMedium: 3.75, minUp: 3.5, facListening: 110, facJam: 130, balladPct: 20, balladHeavyPct: 50,
};

export function defaultRules(genre: GenreConfig): Rules {
  return { ...DEFAULT_RULES, ...(isJazz(genre) ? {} : NON_JAZZ_OVERRIDES) };
}

/** Merge saved (possibly partial / older) rules over the genre defaults, ignoring junk values. */
export function mergeRules(genre: GenreConfig, saved?: Partial<Rules> | null): Rules {
  const out = defaultRules(genre);
  if (saved) {
    for (const k of Object.keys(out) as (keyof Rules)[]) {
      const v = saved[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

export type RuleUnit = "min" | "%" | "songs" | "hours" | "sets" | "lists";

export type RuleDef =
  | {
      kind: "number"; key: keyof Rules; label: string; before: string; after: string;
      unit?: RuleUnit; step: number; min: number; max: number; help?: string;
    }
  | { kind: "toggle"; key: keyof Rules; label: string; help?: string }
  | { kind: "fixed"; text: string };

export interface RuleGroup {
  id: string;
  title: string;
  blurb: string;
  rules: RuleDef[];
}

/** Rules that only make sense for jazz (dropped for other genres, as the old ruleText() did). */
export const JAZZ_ONLY_RULES: (keyof Rules)[] = ["minLatin", "minWaltz", "minBlues", "minTwo", "minModal", "latinEvery"];

export function RULE_GROUPS(genre: GenreConfig): RuleGroup[] {
  const j = isJazz(genre);
  const { one, many, Many } = nouns(genre);
  const ballad = j ? "ballad" : "slow song";
  const ballads = j ? "ballads" : "slow songs";

  const len = (key: keyof Rules, label: string, before: string, help?: string): RuleDef => ({
    kind: "number", key, label, before, after: "minutes", unit: "min", step: 0.25, min: 1, max: 20, ...(help ? { help } : {}),
  });
  const pct = (key: keyof Rules, label: string, before: string, after: string, help?: string): RuleDef => ({
    kind: "number", key, label, before, after, unit: "%", step: 5, min: 30, max: 200, ...(help ? { help } : {}),
  });

  const lengths: RuleDef[] = [
    len("minBallad", j ? "Ballad" : "Slow song", `A ${ballad} runs about`),
    len("minMedium", j ? "Medium swing" : "Mid-tempo song", j ? "A medium swing tune runs about" : "A mid-tempo song runs about"),
    len("minUp", "Up-tempo", `An up-tempo ${one} runs about`),
  ];
  if (j) {
    lengths.push(
      len("minLatin", "Bossa / Latin", "A bossa or Latin tune runs about"),
      len("minWaltz", "Waltz", "A jazz waltz runs about"),
      len("minBlues", "Blues", "A blues runs about"),
      len("minTwo", "Trad two-beat", "A trad two-beat tune runs about"),
      len("minModal", "Modal / post-bop", "A modal or post-bop tune runs about"),
    );
  }

  const groups: RuleGroup[] = [
    {
      id: "lengths",
      title: `How long ${many} run`,
      blurb: `Used to work out how many ${many} fill a set. The feel comes from what you set on each ${one}, or from its style tags if you haven't.`,
      rules: lengths,
    },
    {
      id: "rooms",
      title: "The room",
      blurb: `Different gigs stretch or squeeze each ${one}. 100% means normal length.`,
      rules: [
        pct("facBackground", "Background / dinner", `At background or dinner gigs, ${many} run`, "of normal length", "Fewer solos when nobody's really listening."),
        pct("facListening", "Listening room", `In a listening room, ${many} run`, "of normal length", "More room to stretch out."),
        pct("facJam", "Jam session", `At a jam session, ${many} run`, "of normal length", "Everyone gets a solo."),
        pct("facDance", "Dance", `At a dance, ${many} run`, "of normal length"),
      ],
    },
    {
      id: "shape",
      title: "Gig shape",
      blurb: "How the night is split into sets.",
      rules: [
        { kind: "number", key: "defaultHours", label: "Default gig length", before: "If you don't say how long, the gig is", after: "hours", unit: "hours", step: 0.5, min: 0.5, max: 6 },
        { kind: "number", key: "breakMin", label: "Break length", before: "Breaks between sets are", after: "minutes", unit: "min", step: 5, min: 0, max: 45, help: "Break time comes out of the total, so a 2-hour gig with one 10-minute break is two 55-minute sets." },
        { kind: "fixed", text: "If you don't say how many sets: up to 1¼ hours is one set, up to 2¼ hours is two, up to 3¼ hours is three, and anything longer is four." },
        { kind: "number", key: "backups", label: "Backups", before: "Suggest", after: `backup ${many} you know that aren't in the sets`, unit: "songs", step: 1, min: 0, max: 10 },
      ],
    },
    {
      id: "picking",
      title: `Picking ${many}`,
      blurb: `Which ${many} make the cut.`,
      rules: [
        { kind: "fixed", text: `${Many} you've marked Know it come first. They're matched to the styles you ask for, and a ${one} that fits more of them ranks higher.` },
        { kind: "toggle", key: "shakyOnlyIfShort", label: `Only use Shaky ${many} when there aren't enough Know-it ${many}`, help: "Turn off to mix a few Shaky ones in every time, for practice." },
        { kind: "number", key: "shakyMaxPerSet", label: "Shaky limit", before: `When Shaky ${many} are allowed, use at most`, after: "per set", unit: "songs", step: 1, min: 0, max: 10 },
        { kind: "fixed", text: `Still short? Know-it ${many} are borrowed from neighbouring styles${j ? " (Swing and Trad for a gypsy gig, say)" : ""} and marked "other style". If that's still not enough, the sets run short and the notes tell you.` },
        { kind: "number", key: "recentLists", label: "Avoid repeats", before: `${Many} from your last`, after: "saved set lists rank lower, so you don't repeat yourself", unit: "lists", step: 1, min: 0, max: 10 },
        { kind: "toggle", key: "popularBoost", label: `Favour well-known ${many} at background and dance gigs`, help: `Asking for "crowd favourites" always does this.` },
        { kind: "fixed", text: `A ${one} is never played twice in one night.` },
      ],
    },
    {
      id: "flow",
      title: "Flow & pacing",
      blurb: "How the mix and the running order are balanced.",
      rules: [
        { kind: "number", key: "balladPct", label: `${j ? "Ballads" : "Slow songs"} in a normal mix`, before: "In a normal mix, about", after: `of the ${many} are ${ballads}`, unit: "%", step: 5, min: 0, max: 100 },
        { kind: "number", key: "balladHeavyPct", label: `When you ask for ${ballads}`, before: `When you ask for ${ballads}, about`, after: `of the ${many} are ${ballads}`, unit: "%", step: 5, min: 0, max: 100 },
        { kind: "number", key: "maxBalladsRow", label: `${j ? "Ballads" : "Slow songs"} in a row`, before: "Normally no more than", after: `${ballads} in a row`, unit: "songs", step: 1, min: 1, max: 6 },
        { kind: "number", key: "maxBalladsRowHeavy", label: `${j ? "Ballads" : "Slow songs"} in a row (${ballad}-heavy gigs)`, before: `When you ask for ${ballads}, no more than`, after: `${ballads} in a row`, unit: "songs", step: 1, min: 1, max: 10 },
        ...(j
          ? [{ kind: "number", key: "latinEvery", label: "Latin tunes", before: "In a mixed gig, play about one bossa or Latin tune every", after: "tunes", unit: "songs", step: 1, min: 2, max: 20, help: "Standards with a Latin tag can be played as a bossa to fill this slot." } as RuleDef]
          : []),
        { kind: "number", key: "maxSameFeelRow", label: "Same feel in a row", before: "No more than", after: `${many} with the same feel in a row`, unit: "songs", step: 1, min: 1, max: 10, ...(j ? { help: "Medium swing is allowed to run up to this limit; other feels are spread out more." } : {}) },
        { kind: "number", key: "upMaxBackground", label: "Up-tempo at background gigs", before: "At background or dinner gigs, use at most", after: `up-tempo ${many} per set`, unit: "songs", step: 1, min: 0, max: 10 },
        ...(j ? [{ kind: "fixed", text: "Up-tempo burners (like Cherokee) are never switched to a bossa feel." } as RuleDef] : []),
        { kind: "fixed", text: `${j ? "Ballads, Latin tunes" : "Slow songs"} and up-tempo ${many} are shared out evenly across the sets.` },
        { kind: "fixed", text: `Two ${many} in the same key don't go back to back (only for ${many} where you've entered a key).` },
      ] as RuleDef[],
    },
    {
      id: "ends",
      title: "Openers & closers",
      blurb: "Start strong, finish strong.",
      rules: [
        { kind: "fixed", text: `Each set opens with a well-known ${j ? "medium-tempo tune" : "mid-tempo song"} you know solidly (not Shaky, and not a ${ballad} if it can be helped).` },
        { kind: "fixed", text: `Each set closes with an up-tempo ${one} if there is one, otherwise a strong ${j ? "medium" : "mid-tempo"} ${one}. Never a Shaky one.` },
        { kind: "fixed", text: `Shaky ${many} never open or close a set, and never come second.` },
      ],
    },
  ];

  if (!j) {
    groups.push({
      id: "decades",
      title: "Decades & favourites",
      blurb: "Asking for an era or the hits.",
      rules: [
        { kind: "fixed", text: 'Songs carry their release year. Ask for decades ("80s rock", "sixties soul", "oldies") and those decades are used first.' },
        { kind: "fixed", text: 'Ask for "crowd favourites" or "the hits" and the most-requested songs rank first.' },
      ],
    });
  } else {
    groups[groups.length - 1].rules.push({ kind: "fixed", text: 'Ask for "crowd favourites" and the most-recorded standards rank first.' });
  }
  return groups;
}
