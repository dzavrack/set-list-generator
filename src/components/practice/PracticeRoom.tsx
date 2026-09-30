"use client";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useSongs } from "@/lib/catalog";
import { getGenre } from "@/lib/genres";
import { useCustomSongs, useGenre, useRepertoire } from "@/lib/state";
import { uid } from "@/lib/storage";
import type { Song, Status } from "@/lib/types";
import {
  addSession,
  buildQueue,
  completePlan,
  createPlan,
  creditPlan,
  elapsedMs,
  formatClock,
  lastPractised,
  loggableMinutes,
  newTimer,
  pauseTimer,
  planInfo,
  remainingMs,
  removeSession,
  setTimerLength,
  startTimer,
  stepTemplate,
  timerEndsAt,
  timerPhase,
  toDateStr,
  toggleStep,
  usePracticeLog,
  usePracticePlans,
  usePracticePrefs,
  usePracticeTimer,
  weekStats,
  type PracticePlan,
  type PracticeSession,
  type QueueCandidate,
  type TimerState,
} from "@/lib/practice";
import { toast } from "@/components/ui/Toast";
import { PageHeader, StatCard } from "@/components/ui/Page";
import { playChime, unlockAudio } from "./chime";
import { PlanPanel } from "./PlanPanel";
import { RecentLog, WeekChart } from "./StatsPanel";
import { TimerPanel, fmtMin } from "./TimerPanel";
import { UpNext, type UpNextItem } from "./UpNext";
import { useMounted, useNow } from "./useNow";

const GENERAL = "General practice";

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  return !!t.closest("input, textarea, select, button, a, summary, [role=button], [role=radio], [role=switch]");
}

function subLine(s?: Song) {
  return s ? [s.artist, s.year].filter(Boolean).join(" · ") : undefined;
}

export function PracticeRoom() {
  const mounted = useMounted();
  const [genre] = useGenre();
  const g = getGenre(genre);
  const [custom] = useCustomSongs();
  const { songs, byId, loading } = useSongs(genre, custom);
  const { rep, setStatusMany } = useRepertoire();
  const [plans, setPlans] = usePracticePlans();
  const [log, setLog] = usePracticeLog();
  const [timer, setTimer] = usePracticeTimer();
  const [prefs, setPrefs] = usePracticePrefs();

  const running = timer?.startedAt != null;
  const now = useNow(running ? 250 : 30_000);
  const today = toDateStr(new Date(now));

  // undefined = follow the queue; null = general practice; string = a chosen song
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [announce, setAnnounce] = useState("");
  const [lastRun, setLastRun] = useState<{ minutes: number; title: string; completed: boolean } | null>(null);

  // ---------------------------------------------------------------- queue
  const last = useMemo(() => lastPractised(log), [log]);
  const queue: UpNextItem[] = useMemo(() => {
    const cands: QueueCandidate[] = [];
    const seen = new Set<string>();
    for (const [id, e] of Object.entries(rep)) {
      if ((e.status === "learn" || e.status === "shaky") && byId.has(id)) {
        seen.add(id);
        cands.push({ songId: id, status: e.status, plan: plans[id], lastPractised: last.get(id), rank: byId.get(id)?.rank });
      }
    }
    for (const p of Object.values(plans)) {
      if (!p.done && p.genre === genre && !seen.has(p.songId)) {
        cands.push({ songId: p.songId, status: rep[p.songId]?.status, plan: p, lastPractised: last.get(p.songId) });
      }
    }
    return buildQueue(cands, today).map((q) => {
      const s = byId.get(q.songId);
      return { ...q, title: s?.title ?? plans[q.songId]?.title ?? "Untitled", sub: subLine(s) };
    });
  }, [rep, byId, plans, last, genre, today]);

  const learned = useMemo(
    () =>
      Object.values(plans)
        .filter((p) => p.done && p.genre === genre)
        .sort((a, b) => (b.doneDate ?? "").localeCompare(a.doneDate ?? ""))
        .map((p) => ({ songId: p.songId, title: byId.get(p.songId)?.title ?? p.title, doneDate: p.doneDate, minutes: p.minutes })),
    [plans, genre, byId],
  );

  const titleOf = (id: string | null | undefined) =>
    id == null ? GENERAL : (byId.get(id)?.title ?? plans[id]?.title ?? (timer?.songId === id ? timer.title : undefined) ?? "Untitled");

  // ---------------------------------------------------------------- timer
  const phase = timer ? timerPhase(timer, now) : "idle";
  const active = !!timer && (phase === "running" || phase === "paused");
  // An in-progress run owns the selection; otherwise the user's pick, else the top of the queue.
  const selected: string | null = active ? timer!.songId : picked !== undefined ? picked : (queue[0]?.songId ?? null);
  const shown: TimerState = active ? timer! : newTimer(prefs.minutes, selected, genre, "preview");
  /** Once you act on the auto-picked song, keep it selected even if the queue re-sorts. */
  const pin = () => {
    if (picked === undefined) setPicked(selected);
  };

  const logRun = (t: TimerState, completed: boolean) => {
    const n = Date.now();
    const ms = completed ? t.totalMs : elapsedMs(t, n);
    let claimed = false;
    setTimer((prev) => {
      if (!prev || prev.runId !== t.runId) return prev;
      claimed = true;
      return null;
    });
    if (!claimed) return; // another tab (or an earlier render) already logged this run
    const minutes = loggableMinutes(ms);
    if (!minutes) {
      setAnnounce("Timer reset. Under 30 seconds, so nothing was logged.");
      toast("Under 30 seconds: nothing logged");
      return;
    }
    const endsAt = completed ? (timerEndsAt(t) ?? n) : n;
    const end = new Date(Math.min(endsAt, n));
    const title = t.title ?? titleOf(t.songId);
    const session: PracticeSession = {
      id: t.runId,
      songId: t.songId,
      genre: t.genre,
      title,
      date: toDateStr(end),
      endedAt: end.toISOString(),
      minutes,
      completed,
    };
    setLog((prev) => addSession(prev, session));
    setPlans((prev) => creditPlan(prev, session));
    setLastRun({ minutes, title, completed });
    const msg = `${completed ? "Time's up. " : ""}Logged ${fmtMin(minutes)} on ${title}.`;
    setAnnounce(msg);
    if (completed && prefs.chime && n - endsAt < 90_000) playChime();
  };

  // Countdown reached zero (also catches a timer that expired while the page was closed).
  const onExpire = useEffectEvent((t: TimerState) => logRun(t, true));
  useEffect(() => {
    if (!timer || timer.startedAt == null) return;
    const end = timerEndsAt(timer) ?? Date.now();
    // Background tabs may fire this late; the session is still logged at the true end time.
    const id = window.setTimeout(() => onExpire(timer), Math.max(0, end - Date.now()));
    return () => window.clearTimeout(id);
  }, [timer]);

  const toggle = () => {
    const n = Date.now();
    unlockAudio();
    setLastRun(null);
    if (active && timer) {
      setTimer((prev) => (prev ? (prev.startedAt != null ? pauseTimer(prev, n) : startTimer(prev, n)) : prev));
      setAnnounce(phase === "running" ? "Paused" : "Resumed");
      return;
    }
    pin();
    const t = { ...newTimer(prefs.minutes, selected, genre, uid("ps-")), title: titleOf(selected) };
    setTimer(startTimer(t, n));
    setAnnounce(`Started ${prefs.minutes} minutes on ${t.title}`);
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.code !== "Space" && e.key !== " ") return;
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isTypingTarget(e.target)) return;
    if (document.querySelector("[role=dialog][aria-modal=true]")) return;
    e.preventDefault();
    toggle();
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Show the countdown in the tab title while running.
  const tabClock = running && timer ? formatClock(remainingMs(timer, now)) : null;
  useEffect(() => {
    if (!tabClock) return;
    const prev = document.title;
    document.title = `${tabClock} · Practice`;
    return () => {
      document.title = prev;
    };
  }, [tabClock]);

  const preset = (m: number) => {
    setPrefs((p) => ({ ...p, minutes: m }));
    if (active) setTimer((prev) => (prev ? setTimerLength(prev, m, Date.now()) : prev));
  };
  const addFive = () =>
    setTimer((prev) => (prev ? setTimerLength(prev, Math.round(prev.totalMs / 60_000) + 5, Date.now()) : prev));
  const reset = () => {
    setTimer(null);
    setAnnounce("Timer reset without logging");
  };

  // ---------------------------------------------------------------- selection & plans
  const select = (id: string | null) => {
    if (active && timer && id !== timer.songId) {
      if (elapsedMs(timer, Date.now()) >= 30_000) {
        logRun(timer, false);
      } else {
        setTimer(null);
      }
    }
    setLastRun(null);
    setPicked(id);
  };

  const startPlan = (id: string, days: number) => {
    pin();
    const status = rep[id]?.status;
    setPlans((prev) => ({
      ...prev,
      [id]: createPlan({ songId: id, genre, title: titleOf(id), today, days, steps: stepTemplate(genre, g.noun), fromStatus: status }),
    }));
    if (status !== "learn" && status !== "shaky") setStatusMany([id], "learn");
    setPrefs((p) => ({ ...p, defaultDays: days }));
  };

  const updatePlan = (id: string, fn: (p: PracticePlan) => PracticePlan) => {
    pin();
    setPlans((prev) => (prev[id] ? { ...prev, [id]: fn(prev[id]) } : prev));
  };

  const onToggleStep = (id: string, i: number) => {
    let finishedNow = false;
    updatePlan(id, (p) => {
      const next = toggleStep(p, i);
      finishedNow = next.steps.every((s) => s.done) && !p.steps.every((s) => s.done);
      return next;
    });
    if (finishedNow) {
      toast("All steps done. Ready to move it up?");
      setAnnounce("All steps done. You can mark it as Know it.");
    }
  };

  const promote = (id: string, to: Status) => {
    const title = titleOf(id);
    // setStatusMany sets (never toggles) the status.
    setStatusMany([id], to);
    updatePlan(id, (p) => completePlan(p, today));
    toast(
      to === "know"
        ? `Nice. “${title}” is in your known ${g.noun}s.`
        : `“${title}” moved to Shaky. It stays in your queue to polish.`,
    );
    if (to === "know" && selected === id && !active) setPicked(undefined);
  };

  const removePlan = (id: string) => {
    setPlans((prev) => {
      const out = { ...prev };
      delete out[id];
      return out;
    });
  };

  const addSong = (s: Song) => {
    const st = rep[s.id]?.status;
    if (st !== "learn" && st !== "shaky") setStatusMany([s.id], "learn");
    select(s.id);
    toast(`Added “${s.title}” to your practice queue`);
  };

  const deleteSession = (id: string) => {
    // Apply to both stores from the same snapshot so plan minutes stay consistent.
    const r = removeSession(log, plans, id);
    setLog(() => r.log);
    setPlans(() => r.plans);
  };

  // ---------------------------------------------------------------- render
  if (!mounted) return <RoomSkeleton />;

  const week = weekStats(log, today);
  const selPlan = selected ? plans[selected] : undefined;
  const selInfo = selPlan && !selPlan.done ? planInfo(selPlan, today) : undefined;
  const selSong = selected ? byId.get(selected) : undefined;
  const otherGenre = active && timer && timer.genre !== genre ? getGenre(timer.genre).name : undefined;
  const subject = active && timer ? (timer.title ?? titleOf(timer.songId)) : titleOf(selected);

  const todayMin = week.days.find((d) => d.isToday)?.minutes ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Practice"
        description={`Work up the ${g.noun}s you want on the stand. Minutes and streaks count across every book.`}
      />

      {/* Phones: the numbers scroll sideways so the timer stays near the top. */}
      <section
        aria-label="Practice at a glance"
        className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4 [&>*]:min-w-[156px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:min-w-0"
      >
        <StatCard
          label="Minutes this week"
          value={week.minutes}
          sub={todayMin > 0 ? `${Math.round(todayMin)} today` : "Nothing today yet"}
        />
        <StatCard
          label="Day streak"
          value={week.streak}
          sub={week.streak === 0 ? "Start one today" : week.practisedToday ? "Kept alive today" : "Practise today to keep it"}
        />
        <StatCard
          label="Sessions this week"
          value={week.sessions}
          sub={week.sessions ? `${Math.round(week.minutes / week.sessions)} min on average` : "Ten minutes counts"}
        />
        <StatCard
          label={`${g.noun === "tune" ? "Tunes" : "Songs"} learned`}
          value={learned.length}
          sub="Through a learning plan"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <TimerPanel
            phase={active ? phase : "idle"}
            remainingMs={remainingMs(shown, now)}
            totalMs={shown.totalMs}
            elapsedMs={elapsedMs(shown, now)}
            subject={subject}
            subjectSub={selected ? subLine(selSong) : "Scales, technique, reading"}
            otherGenre={otherGenre}
            onPreset={preset}
            onToggle={toggle}
            onFinish={() => timer && logRun(timer, false)}
            onReset={reset}
            onAddFive={addFive}
            chime={prefs.chime}
            onChime={(v) => {
              setPrefs((p) => ({ ...p, chime: v }));
              if (v) unlockAudio();
            }}
            announce={announce}
            lastRun={lastRun}
          />
          {selected && (
            <PlanPanel
              key={selected}
              songId={selected}
              title={titleOf(selected)}
              sub={subLine(selSong)}
              status={rep[selected]?.status}
              noun={g.noun}
              info={selInfo}
              finished={selPlan?.done ? { doneDate: selPlan.doneDate, minutes: selPlan.minutes } : undefined}
              defaultDays={prefs.defaultDays}
              onStart={(d) => startPlan(selected, d)}
              onToggleStep={(i) => onToggleStep(selected, i)}
              onDays={(d) => updatePlan(selected, (p) => ({ ...p, days: d }))}
              onNotes={(s) => updatePlan(selected, (p) => ({ ...p, notes: s }))}
              onRemove={() => removePlan(selected)}
              onPromote={(to) => promote(selected, to)}
            />
          )}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-1">
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <UpNext
              items={queue}
              selectedId={selected}
              onSelect={select}
              onQuickPlan={(id) => {
                startPlan(id, prefs.defaultDays);
                select(id);
              }}
              loading={loading}
              noun={g.noun}
              songs={songs}
              onAdd={addSong}
              learned={learned}
            />
          </div>
          <WeekChart week={week} />
          <RecentLog log={log} today={today} noun={g.noun} onDelete={deleteSession} />
        </div>
      </div>
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading practice room">
      <div className="h-14 w-56 animate-pulse rounded-lg bg-surface-2/60" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-2xl border border-line bg-surface/60" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        <div className="h-[640px] animate-pulse rounded-2xl border border-line bg-surface/60" />
        <div className="h-[480px] animate-pulse rounded-2xl border border-line bg-surface/60" />
      </div>
    </div>
  );
}
