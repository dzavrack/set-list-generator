import { describe, expect, it } from "vitest";
import {
  addDays,
  addSession,
  buildQueue,
  completePlan,
  createPlan,
  creditPlan,
  daysBetween,
  elapsedMs,
  formatClock,
  loggableMinutes,
  newTimer,
  normalizeLog,
  normalizePlans,
  pauseTimer,
  planInfo,
  promoteStatus,
  remainingMs,
  removeSession,
  setTimerLength,
  startTimer,
  stepTemplate,
  streak,
  timerEndsAt,
  timerPhase,
  toggleStep,
  weekStart,
  weekStats,
  type PracticeSession,
} from "./practice";

const sess = (date: string, minutes: number, songId: string | null = "a", id = `${date}-${songId}-${minutes}`): PracticeSession => ({
  id,
  songId,
  genre: "jazz",
  title: "T",
  date,
  endedAt: `${date}T20:00:00Z`,
  minutes,
  completed: true,
});

describe("dates", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-09-01", "2026-09-29")).toBe(28);
  });
  it("finds Monday", () => {
    expect(weekStart("2026-09-29")).toBe("2026-09-28"); // Tue -> Mon
    expect(weekStart("2026-10-04")).toBe("2026-09-28"); // Sun -> Mon
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
  });
});

describe("step templates", () => {
  it("uses tune steps for jazz and song steps otherwise", () => {
    expect(stepTemplate("jazz")[2]).toBe("Learn the changes");
    expect(stepTemplate("pop")[2]).toBe("Learn the chords");
    expect(stepTemplate("rock")[1]).toBe("Learn the main riff");
  });
  it("returns a copy", () => {
    stepTemplate("jazz").push("x");
    expect(stepTemplate("jazz")).toHaveLength(6);
  });
});

describe("plans", () => {
  const plan = createPlan({ songId: "a", genre: "jazz", title: "Autumn Leaves", today: "2026-09-01", days: 10 });

  it("creates with unchecked steps", () => {
    expect(plan.steps.every((s) => !s.done)).toBe(true);
    expect(plan.days).toBe(10);
  });

  it("computes pace", () => {
    expect(planInfo(plan, "2026-09-01").state).toBe("ontrack");
    expect(planInfo(plan, "2026-09-08").state).toBe("behind");
    expect(planInfo(plan, "2026-09-12").state).toBe("overdue");
    let p = plan;
    for (let i = 0; i < 3; i++) p = toggleStep(p, i);
    expect(planInfo(p, "2026-09-02").state).toBe("ahead");
    for (let i = 3; i < 6; i++) p = toggleStep(p, i);
    const info = planInfo(p, "2026-09-12");
    expect(info.state).toBe("ready");
    expect(info.progress).toBe(1);
    expect(planInfo(completePlan(p, "2026-09-12"), "2026-09-12").state).toBe("done");
  });

  it("promotes Learn -> Shaky -> Know", () => {
    expect(promoteStatus("learn")).toBe("shaky");
    expect(promoteStatus("shaky")).toBe("know");
    expect(promoteStatus("know")).toBe("know");
    expect(promoteStatus(null)).toBe("shaky");
  });

  it("migrates the old app's plan format", () => {
    const out = normalizePlans({
      x: { genre: "blues", start: "2026-01-01", days: 21, steps: [1, 0, 1, 0, 0, 0], mins: 42, log: {}, done: false },
    });
    expect(out.x.startedAt).toBe("2026-01-01");
    expect(out.x.minutes).toBe(42);
    expect(out.x.steps.filter((s) => s.done)).toHaveLength(2);
    expect(out.x.steps[0].label).toBe(stepTemplate("blues")[0]);
    // new format round-trips
    expect(normalizePlans({ a: plan }).a).toEqual(plan);
  });
});

describe("timer", () => {
  const t0 = newTimer(20, "a", "jazz", "run1");

  it("computes from timestamps, not ticks", () => {
    expect(timerPhase(t0, 0)).toBe("idle");
    const run = startTimer(t0, 1_000);
    expect(timerPhase(run, 1_000)).toBe("running");
    // tab backgrounded for 5 minutes: no ticks, still exact
    expect(elapsedMs(run, 1_000 + 300_000)).toBe(300_000);
    const paused = pauseTimer(run, 1_000 + 300_000);
    expect(timerPhase(paused, 10_000_000)).toBe("paused");
    expect(remainingMs(paused, 10_000_000)).toBe(15 * 60_000);
    const resumed = startTimer(paused, 2_000_000);
    expect(timerEndsAt(resumed)).toBe(2_000_000 + 15 * 60_000);
    expect(timerPhase(resumed, 2_000_000 + 15 * 60_000)).toBe("finished");
    expect(remainingMs(resumed, 9e12)).toBe(0);
  });

  it("ignores start on a running or finished timer", () => {
    const run = startTimer(t0, 0);
    expect(startTimer(run, 500)).toBe(run);
  });

  it("changes length while keeping elapsed time", () => {
    const run = startTimer(t0, 0);
    const longer = setTimerLength(run, 45, 60_000);
    expect(elapsedMs(longer, 60_000)).toBe(60_000);
    expect(remainingMs(longer, 60_000)).toBe(44 * 60_000);
    // can't shrink below what's elapsed
    const shrunk = setTimerLength(pauseTimer(run, 10 * 60_000), 5, 10 * 60_000);
    expect(remainingMs(shrunk, 0)).toBe(60_000);
  });

  it("formats and rounds", () => {
    expect(formatClock(20 * 60_000)).toBe("20:00");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(3_600_000 + 5_000)).toBe("1:00:05");
    expect(loggableMinutes(20_000)).toBe(0);
    expect(loggableMinutes(40_000)).toBe(0.5);
    expect(loggableMinutes(20 * 60_000)).toBe(20);
  });
});

describe("log & stats", () => {
  it("dedupes sessions by id and credits plans", () => {
    const s = sess("2026-09-29", 20);
    const log = addSession(addSession([], s), s);
    expect(log).toHaveLength(1);
    const plans = { a: createPlan({ songId: "a", genre: "jazz", title: "A", today: "2026-09-20" }) };
    const credited = creditPlan(plans, s);
    expect(credited.a.minutes).toBe(20);
    const removed = removeSession(log, credited, s.id);
    expect(removed.log).toHaveLength(0);
    expect(removed.plans.a.minutes).toBe(0);
  });

  it("counts streaks that end today or yesterday", () => {
    const log = [sess("2026-09-26", 10), sess("2026-09-27", 5), sess("2026-09-28", 15)];
    expect(streak(log, "2026-09-28")).toBe(3);
    expect(streak(log, "2026-09-29")).toBe(3); // haven't practised yet today
    expect(streak(log, "2026-09-30")).toBe(0);
    expect(streak([...log, sess("2026-09-29", 1)], "2026-09-29")).toBe(4);
  });

  it("sums this week (Mon-Sun)", () => {
    const log = [sess("2026-09-27", 60), sess("2026-09-28", 10), sess("2026-09-29", 15), sess("2026-09-29", 5, null)];
    const w = weekStats(log, "2026-09-29");
    expect(w.minutes).toBe(30);
    expect(w.sessions).toBe(3);
    expect(w.days[0]).toMatchObject({ date: "2026-09-28", minutes: 10 });
    expect(w.days[1]).toMatchObject({ isToday: true, minutes: 20 });
    expect(w.days[6].isFuture).toBe(true);
    expect(w.practisedToday).toBe(true);
  });

  it("migrates the old {date: minutes} log", () => {
    const log = normalizeLog({ "2026-09-02": 12, "2026-09-01": 5, junk: 3 });
    expect(log.map((s) => s.date)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(normalizeLog([sess("2026-09-01", 3)])).toHaveLength(1);
    expect(normalizeLog("nope")).toEqual([]);
  });
});

describe("up next queue", () => {
  const today = "2026-09-29";
  it("puts behind/overdue plans first, then shaky, then learn; skips known", () => {
    const overdue = createPlan({ songId: "o", genre: "jazz", title: "O", today: "2026-09-01", days: 7 });
    const fresh = createPlan({ songId: "f", genre: "jazz", title: "F", today: "2026-09-28", days: 30 });
    const q = buildQueue(
      [
        { songId: "k", status: "know" },
        { songId: "l", status: "learn" },
        { songId: "s", status: "shaky" },
        { songId: "f", status: "learn", plan: fresh },
        { songId: "o", status: "learn", plan: overdue },
      ],
      today,
    );
    expect(q.map((x) => x.songId)).toEqual(["o", "f", "s", "l"]);
    expect(q[0].reason).toMatch(/overdue/);
  });

  it("surfaces plans ready to promote at the top", () => {
    let p = createPlan({ songId: "r", genre: "jazz", title: "R", today: "2026-09-20" });
    p.steps.forEach((_, i) => (p = toggleStep(p, i, true)));
    const q = buildQueue(
      [
        { songId: "o", status: "learn", plan: createPlan({ songId: "o", genre: "jazz", title: "O", today: "2026-09-01", days: 7 }) },
        { songId: "r", status: "learn", plan: p },
      ],
      today,
    );
    expect(q[0].songId).toBe("r");
    expect(q[0].info?.state).toBe("ready");
  });

  it("keeps active plans above songs without one, even if practised today", () => {
    const plan = createPlan({ songId: "p", genre: "jazz", title: "P", today: "2026-09-28", days: 14 });
    const q = buildQueue(
      [
        { songId: "s1", status: "shaky" },
        { songId: "s2", status: "shaky", rank: 1 },
        { songId: "p", status: "learn", plan: toggleStep(toggleStep(plan, 0), 1), lastPractised: today },
      ],
      today,
    );
    expect(q[0].songId).toBe("p");
  });

  it("prefers songs not practised recently", () => {
    const q = buildQueue(
      [
        { songId: "a", status: "learn", lastPractised: today },
        { songId: "b", status: "learn", lastPractised: "2026-09-10" },
      ],
      today,
    );
    expect(q[0].songId).toBe("b");
  });
});
