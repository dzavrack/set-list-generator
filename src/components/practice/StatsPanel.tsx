"use client";
import { useState } from "react";
import { History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Page";
import { cx } from "@/components/ui/cx";
import { daysBetween, type PracticeSession, type WeekStats } from "@/lib/practice";
import { GENRES } from "@/lib/genres";
import { fmtMin } from "./TimerPanel";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const DOW_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Seven thin bars, Monday to Sunday. Only today's bar is lit. */
export function WeekChart({ week }: { week: WeekStats }) {
  const max = Math.max(30, ...week.days.map((d) => d.minutes));
  const best = Math.max(...week.days.map((d) => d.minutes));
  return (
    <Card role="region" aria-labelledby="week-h">
      <CardHeader
        className="px-5 sm:px-6"
        title={<span id="week-h">This week</span>}
        description={week.practisedToday ? "Minutes on the clock each day" : "Nothing logged today yet. Ten minutes counts."}
        actions={<span className="tabular shrink-0 pt-1 font-mono text-xs text-muted">{best > 0 ? `best ${Math.round(best)}m` : ""}</span>}
      />
      <div className="px-5 pt-6 pb-5 sm:px-6" role="img" aria-label={weekSummary(week)}>
        <div className="relative flex h-32 items-end justify-between">
          {/* faint guides at half and full scale */}
          <span aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
          {week.days.map((d, i) => {
            const h = d.minutes > 0 ? `${Math.max(6, (d.minutes / max) * 100)}%` : undefined;
            return (
              <div key={d.date} className="relative flex h-full flex-1 flex-col items-center justify-end" title={`${DOW_LONG[i]}: ${Math.round(d.minutes)} min`}>
                {d.isToday && d.minutes > 0 && (
                  <span className="tabular absolute font-mono text-[11px] text-ink" style={{ bottom: `calc(${h} + 8px)` }}>
                    {Math.round(d.minutes)}
                  </span>
                )}
                {h ? (
                  <span
                    className={cx("w-1.5 rounded-full", !d.isToday && "week-bar", d.isToday ? "tube-v !w-1.5 !bg-[linear-gradient(180deg,var(--neon-core),var(--neon-hot)_18%,var(--neon))]" : "bg-surface-3 shadow-[inset_0_0_0_1px_var(--line-strong)]")}
                    style={{ height: h }}
                  />
                ) : (
                  <span className={cx("h-[5px] w-[5px] rounded-full", d.isToday ? "bg-neon-deep" : d.isFuture ? "bg-surface-2" : "bg-surface-3")} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between border-t border-line pt-2.5">
          {week.days.map((d, i) => (
            <span key={d.date} className={cx("flex-1 text-center font-mono text-[11px]", d.isToday ? "text-ink" : d.isFuture ? "text-faint" : "text-muted")}>
              {DOW[i]}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function weekSummary(w: WeekStats) {
  return (
    "Minutes per day this week: " +
    w.days
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !d.isFuture)
      .map(({ d, i }) => `${DOW_LONG[i]} ${Math.round(d.minutes)}`)
      .join(", ")
  );
}

export function RecentLog({
  log,
  today,
  noun,
  onDelete,
}: {
  log: PracticeSession[];
  today: string;
  noun: string;
  onDelete: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const recent = log.slice(-8).reverse();
  return (
    <Card role="region" aria-labelledby="log-h" className="overflow-hidden">
      <CardHeader className="px-5 sm:px-6" title={<span id="log-h">Recent sessions</span>} />
      {recent.length === 0 ? (
        <div className="flex items-center gap-3.5 px-5 py-6 sm:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2">
            <History className="h-4 w-4 text-muted" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-muted">Sessions you finish land here. Pick a {noun} and start the clock.</p>
        </div>
      ) : (
        <ul>
          {recent.map((s) => {
            const ago = daysBetween(s.date, today);
            const when = ago <= 0 ? "Today" : ago === 1 ? "Yesterday" : `${ago} days ago`;
            const asking = confirm === s.id;
            return (
              <li key={s.id} className="group flex min-h-[60px] items-center gap-3 border-b border-line px-5 py-2.5 last:border-0 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className={cx("truncate", s.songId ? "font-serif title-plain text-[19px] leading-tight text-ink" : "text-[15px] text-ink-2")}>{s.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {when}
                    {GENRES[s.genre] ? ` · ${GENRES[s.genre].name}` : ""}
                    {s.completed ? " · full session" : ""}
                  </p>
                </div>
                {asking ? (
                  <span className="flex shrink-0 gap-1">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        onDelete(s.id);
                        setConfirm(null);
                      }}
                    >
                      Delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <>
                    <span className="tabular shrink-0 font-mono text-[13px] text-ink-2">{fmtMin(s.minutes)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirm(s.id)}
                      aria-label={`Delete session: ${s.title}, ${when}`}
                      className="-mr-2 text-faint sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <Trash2 strokeWidth={1.75} />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
