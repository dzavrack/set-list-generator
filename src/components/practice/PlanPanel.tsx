"use client";
import { useId, useState } from "react";
import { Calendar, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Page";
import { Segmented } from "@/components/ui/Segmented";
import { Select, Textarea } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { statusDot, statusText } from "@/components/ui/Status";
import { PACE_LABEL, PLAN_LENGTHS, promoteStatus, type PaceState, type PlanInfo } from "@/lib/practice";
import { STATUSES, type Status } from "@/lib/types";
import { fmtMin } from "./TimerPanel";
import type { Tone } from "@/components/ui/tone";

/** Pace chips stay neutral unless something needs you: red when ready or overdue, dusty rose when behind. */
/** Marquee colours pace like the reference: green when you're there, blue on track, red behind. */
const paceColour: Record<PaceState, Tone> = { done: "know", ready: "know", ahead: "know", ontrack: "learn", behind: "no", overdue: "no" };

const paceTone: Record<PaceState, string> = {
  done: "border-line-strong text-ink",
  ready: "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] text-neon-hot bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]",
  ahead: "border-line-strong text-ink",
  ontrack: "border-line-strong text-ink-2",
  behind: "border-[rgb(184_96_107/0.5)] text-shaky",
  overdue: "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] text-neon-hot",
};

const START_LENGTHS = [7, 14, 30] as const;

export interface PlanPanelProps {
  songId: string;
  title: string;
  sub?: string;
  status: Status | null | undefined;
  noun: "tune" | "song";
  info?: PlanInfo;
  /** A previously finished plan for this song, if any */
  finished?: { doneDate?: string; minutes: number };
  defaultDays: number;
  onStart: (days: number) => void;
  onToggleStep: (i: number) => void;
  onDays: (d: number) => void;
  onNotes: (s: string) => void;
  onRemove: () => void;
  onPromote: (to: Status) => void;
}

export function PlanPanel(p: PlanPanelProps) {
  const notesId = useId();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [days, setDays] = useState(String((START_LENGTHS as readonly number[]).includes(p.defaultDays) ? p.defaultDays : 14));
  const statusLabel = STATUSES.find((s) => s.value === p.status)?.label;
  const info = p.info;

  return (
    <Card role="region" aria-labelledby="plan-h" data-tone={info ? paceColour[info.state] : undefined} className="plan-card">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="plan-h" className="label">{info ? "Learning plan" : `This ${p.noun}`}</h2>
          <p className="mt-2 truncate font-serif text-[28px] leading-tight text-ink">{p.title}</p>
          {p.sub && <p className="mt-0.5 truncate text-[13px] text-muted">{p.sub}</p>}
        </div>
        {statusLabel && p.status && (
          <span className={cx("mt-0.5 inline-flex h-7 shrink-0 items-center gap-2 rounded-chip border border-line-strong px-3 text-xs font-medium", statusText[p.status])}>
            <span className={cx("h-1.5 w-1.5 rounded-full", statusDot[p.status])} />
            {statusLabel}
          </span>
        )}
      </div>

      {!info ? (
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
          <p className="max-w-lg text-[15px] leading-relaxed text-ink-2">
            {p.finished
              ? `You finished a plan for this${p.finished.doneDate ? ` on ${shortDate(p.finished.doneDate)}` : ""}, with ${fmtMin(p.finished.minutes)} logged. Start another to keep polishing it.`
              : "Give yourself a deadline and six small steps. You can time practice without a plan too."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-ink-2">Learn it in</span>
            <Segmented
              label="Plan length"
              value={days}
              onChange={setDays}
              options={START_LENGTHS.map((d) => ({ value: String(d), label: <span><span className="tabular font-mono">{d}</span> days</span> }))}
            />
            <Button onClick={() => p.onStart(Number(days))}>
              <Plus strokeWidth={1.75} />
              Start a plan
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 px-5 pt-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted">
              <span data-tone={paceColour[info.state]} className={cx("pace-chip inline-flex h-6 items-center rounded-chip border px-2.5 text-xs font-medium", paceTone[info.state])}>{PACE_LABEL[info.state]}</span>
              <span className="tabular">
                {info.daysLeft < 0
                  ? `${-info.daysLeft} day${info.daysLeft === -1 ? "" : "s"} overdue`
                  : info.daysLeft === 0
                    ? "Due today"
                    : `${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"} left`}
              </span>
              <span aria-hidden className="text-faint">·</span>
              <span className="tabular font-mono text-xs">{fmtMin(info.plan.minutes)} logged</span>
              <span className="tabular ml-auto font-mono text-xs text-ink-2">
                {info.stepsDone}/{info.plan.steps.length}
              </span>
            </div>
            <div
              className="relative h-[3px] rounded-full bg-surface-3"
              role="progressbar"
              aria-label="Steps done"
              aria-valuemin={0}
              aria-valuemax={info.plan.steps.length}
              aria-valuenow={info.stepsDone}
              aria-valuetext={`${info.stepsDone} of ${info.plan.steps.length} steps; about ${Math.round(info.expected * 100)}% of the time used`}
            >
              {info.progress > 0 && <div className="tube-h h-full transition-[width] duration-500" style={{ width: `${info.progress * 100}%` }} />}
              <span
                className="absolute -top-[5px] h-[13px] w-px bg-ink-2"
                style={{ left: `${info.expected * 100}%` }}
                title="Where you'd planned to be by today"
                aria-hidden
              />
            </div>
          </div>

          <ol className="mt-3 flex flex-col px-2.5 sm:px-3.5" aria-label="Steps">
            {info.plan.steps.map((s, i) => (
              <li key={i}>
                <label className="group flex min-h-11 cursor-pointer items-center gap-3.5 rounded-control px-2.5 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]">
                  <input type="checkbox" checked={s.done} onChange={() => p.onToggleStep(i)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className={cx(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neon-hot",
                      s.done
                        ? "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-neon-hot"
                        : "border-line-strong bg-surface-2 text-transparent group-hover:border-[color-mix(in_srgb,var(--ink)_24%,transparent)]",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="tabular w-4 shrink-0 font-mono text-[11px] text-faint">{i + 1}</span>
                  <span className={cx("text-[15px] transition-colors", s.done ? "text-muted line-through decoration-faint" : "text-ink")}>{s.label}</span>
                </label>
              </li>
            ))}
          </ol>

          {info.progress >= 1 && (
            <div className="mx-5 mt-4 rounded-xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] p-4 sm:mx-6">
              <p className="font-serif text-[24px] leading-tight text-ink">All steps done</p>
              <p className="mt-1 text-sm text-ink-2">Move it up your list so the set builder can reach for it.</p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <Button onClick={() => p.onPromote("know")} className="border-[color-mix(in_srgb,var(--accent)_55%,transparent)]">
                  <Check strokeWidth={2} />
                  Mark as Know it
                </Button>
                {promoteStatus(p.status) === "shaky" && (
                  <Button variant="ghost" onClick={() => p.onPromote("shaky")}>
                    Not quite, move to Shaky
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 px-5 pt-5 sm:px-6">
            <label htmlFor={notesId} className="text-[13px] text-ink-2">
              Practice notes
            </label>
            <Textarea
              id={notesId}
              value={info.plan.notes}
              onChange={(e) => p.onNotes(e.target.value)}
              rows={3}
              placeholder="Tricky bars, the tempo you can play it at, what to fix next time…"
              className="resize-y"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <Select aria-label="Goal length" value={info.plan.days} onChange={(e) => p.onDays(Number(e.target.value))} className="w-[118px]">
                {[...new Set([...PLAN_LENGTHS, info.plan.days])]
                  .sort((a, b) => a - b)
                  .map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
              </Select>
              <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-muted">
                <Calendar className="h-4 w-4" strokeWidth={1.75} />
                Due <span className="tabular font-mono text-xs text-ink-2">{shortDate(info.due)}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {confirmRemove ? (
                <>
                  <Button variant="danger" size="sm" onClick={p.onRemove}>
                    <Trash2 strokeWidth={1.75} />
                    Remove plan
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                    Keep it
                  </Button>
                </>
              ) : (
                <>
                  {info.progress < 1 && (
                    <Button variant="ghost" size="sm" onClick={() => p.onPromote("know")}>
                      <Check strokeWidth={2} />
                      I know it now
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)} aria-label="Remove plan" title="Remove plan">
                    <Trash2 strokeWidth={1.75} />
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}
