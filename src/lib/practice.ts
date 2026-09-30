"use client";
// Practice room: data model, pure logic (plans, timer, stats, suggestions) and persisted hooks.
// Everything above the "Hooks" section is pure and unit-tested in practice.test.ts.
import { useCallback } from "react";
import { KEYS } from "./state";
import { usePersistent } from "./storage";
import type { GenreKey, Status } from "./types";

// ============================================================ Types

export interface PlanStep {
  label: string;
  done: boolean;
}

/** A multi-day plan for learning one song. Stored in KEYS.practice as Record<songId, PracticePlan>. */
export interface PracticePlan {
  songId: string;
  genre: GenreKey;
  /** Title snapshot so the plan still reads well if the catalog changes. */
  title: string;
  /** Local date yyyy-mm-dd the plan started. */
  startedAt: string;
  /** Goal length in days. */
  days: number;
  steps: PlanStep[];
  notes: string;
  /** Total minutes logged against this song. */
  minutes: number;
  done: boolean;
  doneDate?: string;
  /** Status the song had when the plan started. */
  fromStatus?: Status | null;
}
export type PracticePlans = Record<string, PracticePlan>;

/** One logged session. Stored in KEYS.practiceLog as PracticeSession[] (newest last). */
export interface PracticeSession {
  id: string;
  /** null = general practice (scales, technique...) */
  songId: string | null;
  genre: GenreKey;
  title: string;
  /** Local date yyyy-mm-dd */
  date: string;
  /** ISO timestamp the session ended */
  endedAt: string;
  minutes: number;
  /** True when the timer ran all the way down. */
  completed: boolean;
}

/**
 * A countdown computed from timestamps, never from ticks, so it stays correct in a background tab
 * and survives reloads when persisted.
 */
export interface TimerState {
  /** Unique per run; doubles as the logged session id so a run is never logged twice. */
  runId: string;
  songId: string | null;
  /** Title snapshot for the song being timed (so a run from another genre still has a name). */
  title?: string;
  genre: GenreKey;
  totalMs: number;
  /** Epoch ms the current running stretch began; null when paused/idle. */
  startedAt: number | null;
  /** Elapsed ms banked before the current stretch. */
  accumulatedMs: number;
}

export type TimerPhase = "idle" | "running" | "paused" | "finished";

export interface PracticePrefs {
  chime: boolean;
  defaultDays: number;
  minutes: number;
}

export type PaceState = "done" | "ready" | "overdue" | "behind" | "ontrack" | "ahead";

export interface PlanInfo {
  plan: PracticePlan;
  stepsDone: number;
  /** 0..1 share of steps done */
  progress: number;
  /** 0..1 share of the goal period that has elapsed */
  expected: number;
  due: string;
  daysLeft: number;
  state: PaceState;
}

// ============================================================ Dates (local)

export const DAY_MS = 86_400_000;

export function toDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS);
}

/** Monday of the week containing `s`. */
export function weekStart(s: string): string {
  const d = parseDate(s);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  return addDays(s, -dow);
}

// ============================================================ Step templates

const TEMPLATES: Partial<Record<GenreKey, string[]>> & { tune: string[]; song: string[] } = {
  tune: [
    "Listen to 3 recordings",
    "Learn the melody",
    "Learn the changes",
    "Play it with a chart",
    "Play it from memory",
    "Call it on a gig",
  ],
  song: [
    "Listen to the original",
    "Learn the words & melody",
    "Learn the chords",
    "Play along with the recording",
    "Play it from memory",
    "Play it on a gig",
  ],
  blues: [
    "Listen to 2 versions",
    "Learn the form & turnaround",
    "Learn the riff or head",
    "Sing / play the melody",
    "Play along with the recording",
    "Play it from memory",
  ],
  rock: [
    "Listen to the original",
    "Learn the main riff",
    "Learn the chords & form",
    "Learn the words",
    "Play along with the recording",
    "Play it from memory",
  ],
  hiphop: [
    "Listen to the original",
    "Learn the hook",
    "Learn the verses",
    "Lock the groove with the beat",
    "Run it from memory",
    "Perform it on a gig",
  ],
  wedding: [
    "Listen to the original",
    "Learn the words & melody",
    "Learn the chords",
    "Nail the intro & ending",
    "Play it from memory",
    "Play it on a gig",
  ],
};

/** Plan steps for a genre; jazz uses the "tune" template, genres without their own use "song". */
export function stepTemplate(genre: GenreKey, noun: "tune" | "song" = genre === "jazz" ? "tune" : "song"): string[] {
  return (TEMPLATES[genre] ?? TEMPLATES[noun]).slice();
}

// ============================================================ Plans

export const PLAN_LENGTHS = [7, 14, 21, 30, 60] as const;

export function createPlan(args: {
  songId: string;
  genre: GenreKey;
  title: string;
  today: string;
  days?: number;
  steps?: string[];
  fromStatus?: Status | null;
}): PracticePlan {
  return {
    songId: args.songId,
    genre: args.genre,
    title: args.title,
    startedAt: args.today,
    days: Math.max(1, Math.round(args.days ?? 14)),
    steps: (args.steps ?? stepTemplate(args.genre)).map((label) => ({ label, done: false })),
    notes: "",
    minutes: 0,
    done: false,
    fromStatus: args.fromStatus ?? null,
  };
}

export function toggleStep(plan: PracticePlan, index: number, done?: boolean): PracticePlan {
  return {
    ...plan,
    steps: plan.steps.map((s, i) => (i === index ? { ...s, done: done ?? !s.done } : s)),
  };
}

export function completePlan(plan: PracticePlan, today: string): PracticePlan {
  return { ...plan, done: true, doneDate: today };
}

export function planInfo(plan: PracticePlan, today: string): PlanInfo {
  const total = Math.max(1, plan.steps.length);
  const stepsDone = plan.steps.filter((s) => s.done).length;
  const progress = stepsDone / total;
  const elapsed = Math.max(0, daysBetween(plan.startedAt, today));
  const due = addDays(plan.startedAt, plan.days);
  const daysLeft = daysBetween(today, due);
  const expected = Math.min(1, elapsed / Math.max(1, plan.days));
  let state: PaceState;
  if (plan.done) state = "done";
  else if (progress >= 1) state = "ready";
  else if (daysLeft < 0) state = "overdue";
  else if (progress >= expected + 0.15) state = "ahead";
  else if (progress >= expected - 0.12) state = "ontrack";
  else state = "behind";
  return { plan, stepsDone, progress, expected, due, daysLeft, state };
}

export const PACE_LABEL: Record<PaceState, string> = {
  done: "Learned",
  ready: "All steps done",
  overdue: "Overdue",
  behind: "Behind",
  ontrack: "On track",
  ahead: "Ahead",
};

/** The next rung up the ladder: Learn → Shaky → Know. */
export function promoteStatus(status: Status | null | undefined): Status {
  if (status === "learn" || status === "no" || status == null) return "shaky";
  return "know";
}

/**
 * Accept both this app's plan shape and the old single-file app's
 * `{genre,start,days,steps:[0|1],mins,log,done,doneDate}` so imported backups keep working.
 */
export function normalizePlans(raw: unknown): PracticePlans {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: PracticePlans = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const p = v as Record<string, unknown>;
    const genre = (typeof p.genre === "string" ? p.genre : "jazz") as GenreKey;
    const template = stepTemplate(genre);
    const rawSteps = Array.isArray(p.steps) ? p.steps : [];
    const steps: PlanStep[] = rawSteps.length
      ? rawSteps.map((s, i) =>
          s && typeof s === "object"
            ? { label: String((s as PlanStep).label ?? template[i] ?? `Step ${i + 1}`), done: !!(s as PlanStep).done }
            : { label: template[i] ?? `Step ${i + 1}`, done: !!s },
        )
      : template.map((label) => ({ label, done: false }));
    out[id] = {
      songId: id,
      genre,
      title: typeof p.title === "string" ? p.title : "",
      startedAt: typeof p.startedAt === "string" ? p.startedAt : typeof p.start === "string" ? p.start : toDateStr(),
      days: Number(p.days) > 0 ? Number(p.days) : 14,
      steps,
      notes: typeof p.notes === "string" ? p.notes : "",
      minutes: Number(p.minutes ?? p.mins) || 0,
      done: !!p.done,
      doneDate: typeof p.doneDate === "string" ? p.doneDate : undefined,
      fromStatus: (p.fromStatus as Status | null | undefined) ?? null,
    };
  }
  return out;
}

/** Accepts PracticeSession[] or the old app's `{date: minutes}` log. */
export function normalizeLog(raw: unknown): PracticeSession[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (s): s is PracticeSession => !!s && typeof s === "object" && typeof s.date === "string" && Number(s.minutes) > 0,
    );
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([d, m]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(m) > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, m]) => ({
        id: `legacy-${date}`,
        songId: null,
        genre: "jazz" as GenreKey,
        title: "Practice",
        date,
        endedAt: `${date}T12:00:00.000Z`,
        minutes: Number(m),
        completed: false,
      }));
  }
  return [];
}

// ============================================================ Timer (pure)

export const TIMER_PRESETS = [5, 10, 20, 30, 45, 60] as const;

export function newTimer(minutes: number, songId: string | null, genre: GenreKey, runId: string): TimerState {
  return { runId, songId, genre, totalMs: Math.max(1, minutes) * 60_000, startedAt: null, accumulatedMs: 0 };
}

export function elapsedMs(t: TimerState, now: number): number {
  const run = t.startedAt != null ? Math.max(0, now - t.startedAt) : 0;
  return Math.min(t.totalMs, t.accumulatedMs + run);
}

export function remainingMs(t: TimerState, now: number): number {
  return Math.max(0, t.totalMs - elapsedMs(t, now));
}

export function timerPhase(t: TimerState, now: number): TimerPhase {
  if (remainingMs(t, now) <= 0) return "finished";
  if (t.startedAt != null) return "running";
  return t.accumulatedMs > 0 ? "paused" : "idle";
}

/** Epoch ms the timer reached (or will reach) zero, or null when not running. */
export function timerEndsAt(t: TimerState): number | null {
  return t.startedAt != null ? t.startedAt + (t.totalMs - t.accumulatedMs) : null;
}

export function startTimer(t: TimerState, now: number): TimerState {
  if (t.startedAt != null || remainingMs(t, now) <= 0) return t;
  return { ...t, startedAt: now };
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  if (t.startedAt == null) return t;
  return { ...t, accumulatedMs: elapsedMs(t, now), startedAt: null };
}

export function toggleTimer(t: TimerState, now: number): TimerState {
  return t.startedAt != null ? pauseTimer(t, now) : startTimer(t, now);
}

/** Change the length; keeps elapsed time, never goes below what's already elapsed + 1 min. */
export function setTimerLength(t: TimerState, minutes: number, now: number): TimerState {
  const el = elapsedMs(t, now);
  const totalMs = Math.max(minutes * 60_000, el > 0 ? el + 60_000 : 60_000);
  // Re-anchor so elapsed is preserved exactly.
  return { ...t, totalMs, accumulatedMs: el, startedAt: t.startedAt != null ? now : null };
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Minutes worth logging for a run (rounded to 0.5), or 0 if under 30 seconds. */
export function loggableMinutes(ms: number): number {
  if (ms < 30_000) return 0;
  return Math.max(0.5, Math.round((ms / 60_000) * 2) / 2);
}

// ============================================================ Log & stats

/** Append a session, ignoring duplicates by id (two tabs finishing the same run). */
export function addSession(log: PracticeSession[], s: PracticeSession): PracticeSession[] {
  if (s.minutes <= 0 || log.some((x) => x.id === s.id)) return log;
  return [...log, s];
}

export function minutesByDay(log: PracticeSession[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of log) m.set(s.date, (m.get(s.date) ?? 0) + s.minutes);
  return m;
}

/** Consecutive days with practice ending today (or yesterday, so the streak isn't "lost" before you practise today). */
export function streak(log: PracticeSession[], today: string): number {
  const days = minutesByDay(log);
  let d = today;
  if (!days.get(d)) d = addDays(d, -1);
  let n = 0;
  while ((days.get(d) ?? 0) > 0) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface WeekStats {
  minutes: number;
  sessions: number;
  /** Mon..Sun minutes for the current week */
  days: { date: string; minutes: number; isToday: boolean; isFuture: boolean }[];
  streak: number;
  practisedToday: boolean;
}

export function weekStats(log: PracticeSession[], today: string): WeekStats {
  const start = weekStart(today);
  const byDay = minutesByDay(log);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, minutes: byDay.get(date) ?? 0, isToday: date === today, isFuture: date > today };
  });
  const inWeek = log.filter((s) => s.date >= start && s.date <= today);
  return {
    minutes: Math.round(inWeek.reduce((a, s) => a + s.minutes, 0)),
    sessions: inWeek.length,
    days,
    streak: streak(log, today),
    practisedToday: (byDay.get(today) ?? 0) > 0,
  };
}

export function lastPractised(log: PracticeSession[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of log) {
    if (!s.songId) continue;
    const cur = m.get(s.songId);
    if (!cur || s.date > cur) m.set(s.songId, s.date);
  }
  return m;
}

// ============================================================ Up next

export interface QueueCandidate {
  songId: string;
  status: Status | null | undefined;
  plan?: PracticePlan;
  /** yyyy-mm-dd of the last session on this song */
  lastPractised?: string;
  /** Catalog popularity rank, lower = more requested */
  rank?: number | null;
}

export interface QueueItem extends QueueCandidate {
  info?: PlanInfo;
  /** Short human reason this is where it is in the queue. */
  reason: string;
  score: number;
}

/**
 * Order learn/shaky songs by what most needs attention. Active plans always rank above songs
 * without one: ready-to-promote first (close them out), then overdue, then by how far behind pace;
 * a plan already practised today drops behind the other plans. Songs without a plan follow
 * (shaky before learn, least recently touched, most requested).
 */
export function buildQueue(cands: QueueCandidate[], today: string): QueueItem[] {
  const items: QueueItem[] = [];
  for (const c of cands) {
    if (c.status !== "learn" && c.status !== "shaky" && !(c.plan && !c.plan.done)) continue;
    const active = c.plan && !c.plan.done ? c.plan : undefined;
    const since = c.lastPractised ? daysBetween(c.lastPractised, today) : 999;
    const rankBoost = c.rank != null ? Math.max(0, 50 - Math.min(50, c.rank / 10)) / 50 : 0; // 0..1
    let score: number;
    let reason: string;
    let info: PlanInfo | undefined;
    if (active) {
      info = planInfo(active, today);
      const gap = info.expected - info.progress; // positive = behind
      if (info.state === "ready") {
        score = 3000;
        reason = "All steps done";
      } else if (info.state === "overdue") {
        score = 2000 + Math.min(99, -info.daysLeft);
        reason = `${-info.daysLeft} day${info.daysLeft === -1 ? "" : "s"} overdue`;
      } else {
        score = 1500 + gap * 200 - Math.min(60, info.daysLeft) + Math.min(30, since);
        reason =
          info.state === "behind"
            ? "Behind schedule"
            : info.daysLeft === 0
              ? "Due today"
              : `${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"} left`;
      }
      if (c.lastPractised === today) score -= 1000; // done today: other plans go first, but still above songs without a plan
    } else {
      score = (c.status === "shaky" ? 200 : 100) + Math.min(60, since) + rankBoost * 20;
      reason =
        c.status === "shaky"
          ? since < 999
            ? `Shaky · last played ${since === 0 ? "today" : `${since}d ago`}`
            : "Shaky · polish it"
          : "Want to learn";
    }
    items.push({ ...c, info, reason, score });
  }
  return items.sort((a, b) => b.score - a.score || a.songId.localeCompare(b.songId));
}

/** Credit a session's minutes to its song's plan (if any). */
export function creditPlan(plans: PracticePlans, s: PracticeSession): PracticePlans {
  if (!s.songId || !plans[s.songId]) return plans;
  const p = plans[s.songId];
  return { ...plans, [s.songId]: { ...p, minutes: Math.round((p.minutes + s.minutes) * 10) / 10 } };
}

export function removeSession(log: PracticeSession[], plans: PracticePlans, id: string) {
  const s = log.find((x) => x.id === id);
  if (!s) return { log, plans };
  const nextLog = log.filter((x) => x.id !== id);
  let nextPlans = plans;
  if (s.songId && plans[s.songId]) {
    const p = plans[s.songId];
    nextPlans = { ...plans, [s.songId]: { ...p, minutes: Math.max(0, Math.round((p.minutes - s.minutes) * 10) / 10) } };
  }
  return { log: nextLog, plans: nextPlans };
}

// ============================================================ Hooks (persisted)

/** Ephemeral keys owned by the practice room (not part of backups). */
export const PRACTICE_KEYS = { timer: "practiceTimer", prefs: "practicePrefs" } as const;

const EMPTY_PLANS: PracticePlans = {};
const EMPTY_LOG: PracticeSession[] = [];
const DEFAULT_PREFS: PracticePrefs = { chime: true, defaultDays: 14, minutes: 20 };

export function usePracticePlans() {
  const [raw, setRaw] = usePersistent<unknown>(KEYS.practice, EMPTY_PLANS);
  const plans = raw === EMPTY_PLANS ? EMPTY_PLANS : normalizePlansCached(raw);
  const setPlans = useCallback(
    (fn: (prev: PracticePlans) => PracticePlans) => setRaw((prev: unknown) => fn(normalizePlansCached(prev))),
    [setRaw],
  );
  return [plans, setPlans] as const;
}

export function usePracticeLog() {
  const [raw, setRaw] = usePersistent<unknown>(KEYS.practiceLog, EMPTY_LOG);
  const log = raw === EMPTY_LOG ? EMPTY_LOG : normalizeLogCached(raw);
  const setLog = useCallback(
    (fn: (prev: PracticeSession[]) => PracticeSession[]) => setRaw((prev: unknown) => fn(normalizeLogCached(prev))),
    [setRaw],
  );
  return [log, setLog] as const;
}

export function usePracticeTimer() {
  return usePersistent<TimerState | null>(PRACTICE_KEYS.timer, null);
}

export function usePracticePrefs() {
  const [raw, set] = usePersistent<PracticePrefs>(PRACTICE_KEYS.prefs, DEFAULT_PREFS);
  const prefs = raw === DEFAULT_PREFS ? raw : { ...DEFAULT_PREFS, ...raw };
  return [prefs, set] as const;
}

// Normalising on every render would hand React a new object each time; cache by input identity.
const planCache = new WeakMap<object, PracticePlans>();
function normalizePlansCached(raw: unknown): PracticePlans {
  if (!raw || typeof raw !== "object") return EMPTY_PLANS;
  let hit = planCache.get(raw);
  if (!hit) planCache.set(raw, (hit = normalizePlans(raw)));
  return hit;
}
const logCache = new WeakMap<object, PracticeSession[]>();
function normalizeLogCached(raw: unknown): PracticeSession[] {
  if (!raw || typeof raw !== "object") return EMPTY_LOG;
  let hit = logCache.get(raw);
  if (!hit) logCache.set(raw, (hit = normalizeLog(raw)));
  return hit;
}
