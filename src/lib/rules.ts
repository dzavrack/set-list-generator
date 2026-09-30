"use client";
import { useMemo } from "react";
import { defaultRules } from "@/lib/engine";
import { GENRES } from "@/lib/genres";
import { usePersistent } from "@/lib/storage";
import { KEYS } from "@/lib/state";
import type { GenreKey, Rules } from "@/lib/types";

const EMPTY: Partial<Rules> = {};

/** The genre's rules: defaults overlaid with anything the user changed. */
export function useRules(genre: GenreKey) {
  const [overrides, setOverrides] = usePersistent<Partial<Rules>>(KEYS.rules(genre), EMPTY);
  const defaults = useMemo(() => defaultRules(GENRES[genre]), [genre]);
  const rules = useMemo(() => ({ ...defaults, ...overrides }), [defaults, overrides]);
  const set = (key: keyof Rules, value: number) =>
    setOverrides((prev) => {
      const next = { ...prev, [key]: value };
      if (defaults[key] === value) delete next[key];
      return next;
    });
  const reset = (key?: keyof Rules) =>
    setOverrides((prev) => {
      if (!key) return {};
      const next = { ...prev };
      delete next[key];
      return next;
    });
  return { rules, defaults, overrides, set, reset };
}
