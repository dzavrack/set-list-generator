"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Wall-clock "now" that re-renders every `intervalMs`, and immediately when the tab becomes visible again.
 * Only drives re-renders: all timing maths uses timestamps, so throttled background tabs stay exact.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tick);
    tick();
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", tick);
    };
  }, [intervalMs]);
  return now;
}

const noop = () => () => {};
/** False during the static render and hydration, true afterwards. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
