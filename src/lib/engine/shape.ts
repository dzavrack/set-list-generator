// How many sets, and how long each one is.
import type { GigRequest, Rules } from "../types";

export interface GigShape {
  sets: number;
  minutesPerSet: number;
  /** Whole night including breaks (0 when the request is a plain song count). */
  totalMinutes: number;
  count?: number;
}

export function planShape(req: GigRequest, rules: Rules): GigShape {
  if (req.count && req.count > 0) return { sets: 1, minutesPerSet: 0, totalMinutes: 0, count: Math.round(req.count) };
  const brk = Math.max(0, rules.breakMin || 0);
  const hours = req.hours && req.hours > 0 ? req.hours : 0;
  const total = (hours || rules.defaultHours || 2) * 60;
  let sets = req.sets && req.sets > 0 ? Math.round(req.sets) : 0;
  let setMin = req.setMinutes && req.setMinutes > 0 ? req.setMinutes : 0;
  if (!sets && setMin && hours) sets = Math.max(1, Math.round((total + brk) / (setMin + brk)));
  if (!sets) {
    const H = total / 60;
    sets = H <= 1.25 ? 1 : H <= 2.25 ? 2 : H <= 3.25 ? 3 : 4;
  }
  // Fix: old code could produce zero/negative set lengths when breaks ate the whole gig.
  if (!setMin) setMin = Math.max(5, Math.round((total - brk * (sets - 1)) / sets));
  const totalMinutes = hours && !(req.sets && req.setMinutes) ? Math.round(total) : sets * setMin + brk * (sets - 1);
  return { sets, minutesPerSet: setMin, totalMinutes };
}
