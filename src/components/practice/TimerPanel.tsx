"use client";
import { Check, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Page";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { TIMER_PRESETS, formatClock, type TimerPhase } from "@/lib/practice";

const R = 92;
const C = 2 * Math.PI * R;

export interface TimerPanelProps {
  phase: TimerPhase;
  remainingMs: number;
  totalMs: number;
  elapsedMs: number;
  /** What's being practised: song title or "General practice" */
  subject: string;
  subjectSub?: string;
  /** Genre of an in-progress run when it's not the genre on screen */
  otherGenre?: string;
  onPreset: (min: number) => void;
  onToggle: () => void;
  onFinish: () => void;
  onReset: () => void;
  onAddFive: () => void;
  chime: boolean;
  onChime: (v: boolean) => void;
  /** Screen-reader announcement (time's up / logged) */
  announce: string;
  /** Visible confirmation after a run is logged */
  lastRun?: { minutes: number; title: string; completed: boolean } | null;
}

export function TimerPanel(p: TimerPanelProps) {
  const frac = p.totalMs > 0 ? Math.min(1, p.elapsedMs / p.totalMs) : 0;
  const running = p.phase === "running";
  const paused = p.phase === "paused";
  const active = running || paused;
  const totalMin = Math.round(p.totalMs / 60_000);
  // Tip of the lit arc, for the hot bead at its end (0deg = 12 o'clock).
  const a = frac * 2 * Math.PI - Math.PI / 2;
  const tip = { x: 100 + R * Math.cos(a), y: 100 + R * Math.sin(a) };

  return (
    <Card aria-labelledby="timer-h" role="region" className="relative overflow-hidden">
      {/* a faint red haze behind the dial, brighter while the clock runs */}
      <div
        aria-hidden
        className={cx(
          "pointer-events-none absolute top-24 left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_43_69/0.13),transparent)] blur-2xl transition-opacity duration-700",
          running ? "opacity-100" : "opacity-30",
        )}
      />

      <div className="relative flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 sm:px-6">
        <h2 id="timer-h" className="label flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden
            className={cx("h-1.5 w-1.5 rounded-full", running ? "bg-neon shadow-[0_0_8px_var(--neon)]" : paused ? "bg-shaky" : "bg-faint")}
          />
          {running ? "On the clock" : paused ? "Paused" : "Practice timer"}
        </h2>
        <Toggle checked={p.chime} onChange={p.onChime} label="End chime" />
      </div>

      <div className="relative flex flex-col items-center px-5 pt-8 pb-7 sm:px-8 sm:pt-10 sm:pb-8">
        <div className="max-w-xl text-center">
          <p className="line-clamp-2 font-serif text-[34px] leading-[1.05] text-ink sm:text-[42px]">{p.subject}</p>
          {(p.subjectSub || p.otherGenre) && (
            <p className="mt-2 truncate text-sm text-muted">
              {p.otherGenre ? `${p.otherGenre} · ` : ""}
              {p.subjectSub}
            </p>
          )}
        </div>

        <div className="relative mt-7 aspect-square w-full max-w-[300px]">
          <svg viewBox="0 0 200 200" className="size-full overflow-visible" aria-hidden>
            {/* unlit glass */}
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(255 236 228 / 0.07)" strokeWidth="2.5" />
            {Array.from({ length: 60 }, (_, i) => (
              <line
                key={i}
                x1="100"
                y1={i % 5 === 0 ? 17 : 18.5}
                x2="100"
                y2="21"
                transform={`rotate(${i * 6} 100 100)`}
                stroke={i % 15 === 0 ? "var(--muted)" : i % 5 === 0 ? "var(--faint)" : "rgb(255 236 228 / 0.1)"}
                strokeWidth={i % 5 === 0 ? 0.9 : 0.5}
                strokeLinecap="round"
              />
            ))}
            {frac > 0 && (
              <g
                transform="rotate(-90 100 100)"
                style={{
                  filter: running
                    ? "drop-shadow(0 0 2px var(--neon)) drop-shadow(0 0 7px var(--neon)) drop-shadow(0 0 18px var(--neon-glow))"
                    : "drop-shadow(0 0 4px rgb(255 43 69 / 0.35))",
                  transition: "filter 150ms",
                }}
              >
                {/* tube: red glass with a pale hot core */}
                <circle
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={running ? "var(--neon)" : "var(--neon-deep)"}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - frac)}
                  style={{ transition: "stroke-dashoffset 300ms linear" }}
                />
                <circle
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={running ? "var(--neon-core)" : "var(--shaky)"}
                  strokeOpacity={running ? 0.9 : 0.5}
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - frac)}
                  style={{ transition: "stroke-dashoffset 300ms linear" }}
                />
              </g>
            )}
            {frac > 0 && frac < 1 && (
              <circle
                cx={tip.x}
                cy={tip.y}
                r="2.6"
                fill={running ? "#fff" : "var(--shaky)"}
                style={{ filter: running ? "drop-shadow(0 0 4px var(--neon-hot)) drop-shadow(0 0 10px var(--neon))" : undefined }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              role="timer"
              aria-label={`${formatClock(p.remainingMs)} remaining`}
              className={cx(
                "tabular font-mono text-[60px] leading-none font-light tracking-[-0.04em] transition-colors sm:text-[68px]",
                running ? "text-ink" : "text-ink-2",
              )}
            >
              {formatClock(p.remainingMs)}
            </span>
            <span className="tabular mt-3 font-mono text-xs text-muted">
              {active ? `${formatClock(p.elapsedMs)} of ${totalMin}:00` : `${totalMin} min session`}
            </span>
          </div>
        </div>

        <div className="mt-7 flex flex-col items-center gap-2">
          <Segmented
            label="Session length in minutes"
            value={String(totalMin)}
            onChange={(v) => p.onPreset(Number(v))}
            options={TIMER_PRESETS.map((m) => ({ value: String(m), label: <span className="tabular font-mono">{m}</span> }))}
          />
          <span className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">Minutes</span>
        </div>

        <div className="mt-6 flex w-full flex-wrap items-center justify-center gap-2">
          {active && (
            <Button variant="ghost" size="lg" onClick={p.onReset} aria-label="Reset timer without logging" title="Reset without logging" className="w-12 px-0 max-sm:order-2">
              <RotateCcw strokeWidth={1.75} />
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={p.onToggle} aria-keyshortcuts="Space" className="min-w-40 max-sm:order-1 max-sm:w-full">
            {running ? <Pause strokeWidth={2} fill="currentColor" /> : <Play strokeWidth={2} fill="currentColor" />}
            {running ? "Pause" : paused ? "Resume" : "Start"}
          </Button>
          {active && (
            <>
              <Button size="lg" onClick={p.onFinish} aria-label="Finish and log this session" className="max-sm:order-3">
                <Check strokeWidth={2} />
                Finish
              </Button>
              <Button variant="ghost" size="lg" onClick={p.onAddFive} aria-label="Add five minutes" className="px-4 max-sm:order-4">
                <Plus strokeWidth={1.75} />
                <span className="tabular font-mono text-sm">5</span>
              </Button>
            </>
          )}
        </div>

        {p.lastRun && !active ? (
          <p className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface-2/70 py-1.5 pr-4 pl-2.5 text-[13px] text-ink-2">
            <Check className="h-3.5 w-3.5 shrink-0 text-neon-hot" strokeWidth={2.25} />
            <span className="truncate">
              {p.lastRun.completed ? "Time. " : ""}Logged <span className="tabular font-mono text-ink">{fmtMin(p.lastRun.minutes)}</span> on{" "}
              <span className="font-serif text-[15px] text-ink">{p.lastRun.title}</span>
            </span>
          </p>
        ) : (
          <p className="mt-6 hidden text-center text-xs text-faint sm:block">
            <kbd className="mr-1 rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">Space</kbd>
            starts and pauses. The clock keeps time if you switch tabs or reload.
          </p>
        )}

        <p aria-live="polite" role="status" className="sr-only">
          {p.announce}
        </p>
      </div>
    </Card>
  );
}

export function fmtMin(m: number) {
  return `${Number.isInteger(m) ? m : m.toFixed(1)} min`;
}
