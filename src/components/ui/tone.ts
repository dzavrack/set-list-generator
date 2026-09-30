import type { Status } from "@/lib/types";

/**
 * A colour role, set with `data-tone` (globals.css maps it to `--tone`). The Marquee look
 * uses it to colour stat tiles, song rows, nav icons and pace chips; Noir ignores it.
 */
export type Tone = Status | "accent";
