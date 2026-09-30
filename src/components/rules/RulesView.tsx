"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarRange, Check, DatabaseBackup, Clock, DoorOpen, Flag, LayoutList, ListChecks, Minus, Plus, RotateCcw, Waves, type LucideIcon } from "lucide-react";
import type { Rules } from "@/lib/types";
import { GENRES } from "@/lib/genres";
import { RULE_GROUPS, type RuleDef, type RuleUnit } from "@/lib/engine";
import { useGenre } from "@/lib/state";
import { useRules } from "@/lib/rules";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { Card, CardHeader, PageHeader } from "@/components/ui/Page";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/Toast";

const GROUP_ICONS: Record<string, LucideIcon> = {
  lengths: Clock,
  rooms: DoorOpen,
  shape: LayoutList,
  picking: ListChecks,
  flow: Waves,
  ends: Flag,
  decades: CalendarRange,
};

const UNIT: Record<RuleUnit, string> = { min: "min", "%": "%", songs: "songs", hours: "hrs", sets: "sets", lists: "lists" };

/** Trim float noise: 5.5 stays 5.5, 3.75 stays 3.75, 6 stays 6. */
const fmt = (v: number) => String(Math.round(v * 100) / 100);

function Stepper({ value, onChange, step, min, max, unit, label }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; unit?: string; label: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const btn = "grid h-full w-9 place-items-center text-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:opacity-30";
  return (
    <div role="group" aria-label={label} className="inline-flex h-10 shrink-0 self-start sm:self-auto items-stretch overflow-hidden rounded-[10px] border border-line-strong bg-surface-2">
      <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min} className={btn}>
        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <label className="flex items-center gap-1 border-x border-line px-2">
        <input
          type="number"
          inputMode="decimal"
          aria-label={label}
          value={fmt(value)}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="tabular w-10 [appearance:textfield] bg-transparent text-right font-mono text-sm text-ink focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit && <span className="w-9 font-mono text-[11px] text-muted">{unit}</span>}
      </label>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max} className={btn}>
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

function ChangedNote({ from, onReset }: { from: number; onReset: () => void }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_6px_var(--neon)]" />
      Changed from <span className="tabular font-mono text-ink-2">{from}</span>
      <span aria-hidden>·</span>
      <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-ink-2 underline-offset-2 hover:text-ink hover:underline">
        <RotateCcw className="h-3 w-3" strokeWidth={2} />
        Reset
      </button>
    </p>
  );
}

export function RulesView() {
  const [genreKey] = useGenre();
  const genre = GENRES[genreKey];
  const { rules, defaults, overrides, set, reset } = useRules(genreKey);
  const groups = useMemo(() => RULE_GROUPS(genre), [genre]);
  const changedCount = Object.keys(overrides).length;
  const [confirmReset, setConfirmReset] = useState(false);
  if (confirmReset && changedCount === 0) setConfirmReset(false);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={`${genre.name} book`}
        title="House rules"
        description={`How the builder thinks when it writes a set. Change a number and the next set list follows it. Feels come from what you set on each ${genre.noun}, or from its style.`}
        actions={
          confirmReset ? (
            <div role="group" aria-label="Confirm reset" className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-2">
                Reset {changedCount} changed {changedCount === 1 ? "rule" : "rules"}?
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                  toast("All rules back to the defaults");
                }}
              >
                <RotateCcw strokeWidth={1.75} />
                Yes, reset
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="max-sm:-ml-4" disabled={changedCount === 0} onClick={() => setConfirmReset(true)}>
              <RotateCcw strokeWidth={1.75} />
              {changedCount ? `Reset all · ${changedCount} changed` : "Reset all"}
            </Button>
          )
        }
      />

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] xl:gap-12">
        <nav aria-label="Rule groups" className="hidden lg:block">
          <ul className="sticky top-12 flex flex-col gap-0.5">
            <li className="label mb-2 px-3">On this page</li>
            {groups.map((g) => {
              const Icon = GROUP_ICONS[g.id] ?? ListChecks;
              const n = g.rules.filter((r) => r.kind !== "fixed" && r.key in overrides).length;
              return (
                <li key={g.id}>
                  <a href={`#rules-${g.id}`} className="group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-[rgb(255_236_228/0.04)] hover:text-ink">
                    <Icon className="h-4 w-4 shrink-0 text-muted group-hover:text-ink-2" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{g.title}</span>
                    {n > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon shadow-[0_0_6px_var(--neon)]" aria-label={`${n} changed`} />}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex max-w-3xl min-w-0 flex-col gap-6">
          {groups.map((g) => {
            const Icon = GROUP_ICONS[g.id] ?? ListChecks;
            const settings = g.rules.filter((r): r is Exclude<RuleDef, { kind: "fixed" }> => r.kind !== "fixed");
            const fixed = g.rules.filter((r): r is Extract<RuleDef, { kind: "fixed" }> => r.kind === "fixed");
            return (
              <Card key={g.id} id={`rules-${g.id}`} className="scroll-mt-24 overflow-hidden">
                <CardHeader
                  className="px-5 sm:px-6"
                  title={
                    <span className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2">
                        <Icon className="h-4 w-4 text-ink-2" strokeWidth={1.75} />
                      </span>
                      {g.title}
                    </span>
                  }
                  description={g.blurb ? <span className="block pl-11">{g.blurb}</span> : undefined}
                />
                {settings.length > 0 && (
                  <ul className="divide-y divide-line">
                    {settings.map((r) => {
                      const key = r.key as keyof Rules;
                      const changed = key in overrides;
                      const reset1 = () => reset(key);
                      if (r.kind === "toggle") {
                        return (
                          <li key={key} className="px-5 py-4 sm:px-6">
                            <Toggle checked={!!rules[key]} onChange={(v) => set(key, v ? 1 : 0)} label={r.label} hint={r.help} />
                            {changed && <div className="pl-[50px]"><ChangedNote from={defaults[key] ? 1 : 0} onReset={reset1} /></div>}
                          </li>
                        );
                      }
                      const helper = r.help ?? `${r.before} ${fmt(rules[key])}${r.unit === "%" ? "%" : ""} ${r.after}`.trim();
                      return (
                        <li key={key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink">{r.label}</p>
                            <p className="mt-0.5 text-[13px] leading-snug text-muted">{helper}</p>
                            {changed && <ChangedNote from={defaults[key]} onReset={reset1} />}
                          </div>
                          <Stepper
                            label={r.label}
                            value={rules[key]}
                            onChange={(v) => set(key, v)}
                            step={r.step}
                            min={r.min}
                            max={r.max}
                            unit={r.unit ? UNIT[r.unit] : undefined}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {fixed.length > 0 && (
                  <div className={cx("px-5 py-4 sm:px-6", settings.length > 0 && "border-t border-line bg-[rgb(255_236_228/0.015)]")}>
                    {settings.length > 0 && <p className="label mb-3">Always</p>}
                    <ul className="flex flex-col gap-2.5">
                      {fixed.map((r, i) => (
                        <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-ink-2">
                          <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-neon-hot" strokeWidth={2} />
                          <span>{r.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
          <Link
            href="/backup/"
            className="group flex items-center gap-4 rounded-2xl border border-dashed border-line-strong px-5 py-4 transition-colors hover:border-[rgb(255_236_228/0.22)] hover:bg-surface-2/50 sm:px-6"
          >
            <DatabaseBackup className="h-[18px] w-[18px] shrink-0 text-muted group-hover:text-ink-2" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">Back up your book</span>
              <span className="block text-[13px] text-muted">Rules, statuses and set lists live in this browser. Save a copy on the Backup page.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted group-hover:text-ink" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </div>
  );
}
