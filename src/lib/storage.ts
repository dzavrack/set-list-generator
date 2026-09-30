"use client";
// Browser-only persistence. All app data lives in localStorage under the "sl:" prefix.
import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "sl:";
const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

export function readKey<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PREFIX + key);
  } catch {
    return fallback;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return (hit.value ?? fallback) as T;
  let value: unknown = fallback;
  if (raw != null) {
    try {
      value = JSON.parse(raw);
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value as T;
}

export function writeKey<T>(key: string, value: T) {
  try {
    const raw = JSON.stringify(value);
    window.localStorage.setItem(PREFIX + key, raw);
    cache.set(key, { raw, value });
  } catch {
    // Storage full or blocked: keep the in-memory value so the session still works.
    cache.set(key, { raw: null, value });
  }
  listeners.get(key)?.forEach((fn) => fn());
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {}
  cache.delete(key);
  listeners.get(key)?.forEach((fn) => fn());
}

export function allKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
  } catch {}
  return out;
}

function subscribe(key: string, fn: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PREFIX + key) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set!.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * React state persisted to localStorage and shared across every component using the same key.
 * Returns the fallback during SSR / static export, then hydrates on the client.
 */
export function usePersistent<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    useCallback((fn) => subscribe(key, fn), [key]),
    () => readKey(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readKey(key, fallback);
      writeKey(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    // fallback is intentionally excluded: callers pass literals
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
