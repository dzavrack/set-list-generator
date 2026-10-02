// PDF export built on @react-pdf/renderer.
//
// The renderer is heavy (~1 MB), so this module only imports its *types* statically.
// `downloadSetListPdf` loads it on demand; `createSetListDocument` takes the loaded module
// as an argument so the same document code runs in the browser and in node tests.
import type { ReactElement, ReactNode } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { SetItem, SetList, Song } from "../types";
import {
  FLAG_LABELS,
  exportFileName,
  formatDuration,
  formatGigDate,
  itemsMinutes,
  setListTotals,
} from "./text";

type ReactPdf = typeof import("@react-pdf/renderer");

export type PdfTheme = "noir" | "print";
export type PdfLayout = "plain" | "one-page" | "set-per-page" | "stage" | "compact";

export interface PdfOptions {
  theme: PdfTheme;
  layout: PdfLayout;
  showKeys: boolean;
  showFeels: boolean;
  showTimes: boolean;
  showBackups: boolean;
  /** Composer / year, when the songs map has them. */
  showCredits: boolean;
  songs?: Map<string, Song>;
  pageSize?: "LETTER" | "A4";
  /** URL (or, in node, a directory path) of the folder holding the bundled TTFs, ending in "/". */
  fontsUrl?: string;
}

export const DEFAULT_PDF_OPTIONS: Omit<PdfOptions, "songs" | "fontsUrl"> = {
  theme: "print",
  layout: "one-page",
  showKeys: true,
  showFeels: true,
  showTimes: true,
  showBackups: true,
  showCredits: false,
  pageSize: "LETTER",
};

export const PDF_THEMES: { value: PdfTheme; label: string; description: string }[] = [
  { value: "noir", label: "Noir", description: "Dark page, neon title. Easy on the eyes on a phone or tablet onstage." },
  { value: "print", label: "Print", description: "White page, black ink, a touch of red. Prints clean and cheap." },
];

export const PDF_LAYOUTS: { value: PdfLayout; label: string; description: string }[] = [
  { value: "plain", label: "Plain", description: "Just the set list: venue and date, then the numbered titles. Nothing else." },
  { value: "one-page", label: "One page", description: "Every set on a single sheet, side by side." },
  { value: "set-per-page", label: "Set per page", description: "One set per page in big type for the music stand." },
  { value: "stage", label: "Stage floor", description: "Huge bold titles, one set per page. Tape it down and read it from a few feet away." },
  { value: "compact", label: "Compact", description: "Every set in one tight column. A pocket copy, or a long night on as few pages as possible." },
];

// ---------------------------------------------------------------------------
// Theme palettes

interface Palette {
  page: string;
  ink: string;
  ink2: string;
  muted: string;
  faint: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  /** Name colour in the marquee. */
  marquee: string;
  key: string;
  bulb: string;
  /** Glow rings around the marquee, innermost first (noir only). */
  glow: string[];
  haze: boolean;
}

function hex(n: number) {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
}
/** Blend colour `a` over `b` at opacity t (solid result: react-pdf alpha support is patchy). */
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => hex(v * t + pb[i] * (1 - t))).join("");
}

const NOIR_BG = "#0a0708";
const NEON = "#ff2d45";

const PALETTES: Record<PdfTheme, Palette> = {
  noir: {
    page: NOIR_BG,
    ink: "#f3e8de",
    ink2: "#cdbdb2",
    muted: "#9a857d",
    faint: "#6b5a55",
    rule: "#2a1d1f",
    ruleStrong: "#4a3334",
    accent: NEON,
    marquee: "#ff5468",
    key: "#f2a950",
    bulb: "#f2a950",
    glow: [mix(NEON, NOIR_BG, 0.35), mix(NEON, NOIR_BG, 0.14), mix(NEON, NOIR_BG, 0.06)],
    haze: true,
  },
  print: {
    page: "#ffffff",
    ink: "#141112",
    ink2: "#3a3334",
    muted: "#6e6567",
    faint: "#a39a9b",
    rule: "#e2dcdc",
    ruleStrong: "#141112",
    accent: "#d1122b",
    marquee: "#141112",
    key: "#141112",
    bulb: "#d1122b",
    glow: [],
    haze: false,
  },
};

// ---------------------------------------------------------------------------
// Fonts

const FAMILY = { display: "SL Display", serif: "SL Serif", body: "SL Body", mono: "SL Mono" } as const;
let registeredFontsUrl: string | null = null;

/**
 * Where the bundled fonts live. The app is a static export that may be hosted under a
 * sub-path, and pages use trailing slashes, so resolve from the Next asset scripts
 * (".../_next/...") rather than from the current page URL.
 */
export function defaultFontsUrl(): string {
  if (typeof document === "undefined") return "/fonts/";
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="/_next/"]');
  for (const s of Array.from(scripts)) {
    const i = s.src.indexOf("/_next/");
    if (i >= 0) return s.src.slice(0, i) + "/fonts/";
  }
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return new URL(`${base}/fonts/`, window.location.origin).href;
}

export function registerPdfFonts(R: ReactPdf, fontsUrl: string = defaultFontsUrl()) {
  if (registeredFontsUrl === fontsUrl) return;
  const f = (name: string) => fontsUrl + name;
  R.Font.register({
    family: FAMILY.display,
    fonts: [
      { src: f("BigShoulders-Bold.ttf"), fontWeight: 700 },
      { src: f("BigShoulders-ExtraBold.ttf"), fontWeight: 800 },
    ],
  });
  R.Font.register({
    family: FAMILY.serif,
    fonts: [
      { src: f("PlayfairDisplay-Regular.ttf"), fontWeight: 400 },
      { src: f("PlayfairDisplay-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: f("PlayfairDisplay-Bold.ttf"), fontWeight: 700 },
    ],
  });
  R.Font.register({
    family: FAMILY.body,
    fonts: [
      { src: f("Manrope-Regular.ttf"), fontWeight: 400 },
      { src: f("Manrope-SemiBold.ttf"), fontWeight: 600 },
      { src: f("Manrope-Bold.ttf"), fontWeight: 700 },
    ],
  });
  R.Font.register({
    family: FAMILY.mono,
    fonts: [
      { src: f("JetBrainsMono-Regular.ttf"), fontWeight: 400 },
      { src: f("JetBrainsMono-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  // Never hyphenate: a song title split across lines is unreadable from a music stand.
  R.Font.registerHyphenationCallback((word) => [word]);
  registeredFontsUrl = fontsUrl;
}

// ---------------------------------------------------------------------------
// Layout maths

const PAGE_DIMS = { LETTER: [612, 792], A4: [595.28, 841.89] } as const;
const MARGIN_X = 40;
const MARGIN_TOP = 34;
const MARGIN_BOTTOM = 52;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function creditFor(item: SetItem, opts: PdfOptions): string {
  if (!opts.showCredits) return "";
  const song = opts.songs?.get(item.songId);
  if (!song) return "";
  const who = song.composer || song.artist || "";
  const year = song.publishYear ?? song.year;
  return [who, year ? String(year) : ""].filter(Boolean).join(", ");
}

function flagTags(item: SetItem): string[] {
  return (item.flags ?? []).map((f) => FLAG_LABELS[f] ?? f).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Document

export function createSetListDocument(R: ReactPdf, sl: SetList, options: Partial<PdfOptions> = {}): ReactElement<DocumentProps> {
  const opts: PdfOptions = { ...DEFAULT_PDF_OPTIONS, ...options };
  registerPdfFonts(R, opts.fontsUrl);
  const { Document, Page, View, Text, Svg, Defs, RadialGradient, Stop, Rect } = R;
  const p = PALETTES[opts.theme];
  const size = opts.pageSize ?? "LETTER";
  const [pageW, pageH] = PAGE_DIMS[size];
  const contentW = pageW - MARGIN_X * 2;

  const totals = setListTotals(sl);
  const dateLong = formatGigDate(sl.date);
  const dateShort = formatGigDate(sl.date, "short");
  // The venue is the headline, in bold. A name the player gave the list (not an automatic
  // "... Set List") rides along under it with the date.
  const venue = sl.venue?.trim() ?? "";
  const customName = sl.name && !/set list$/i.test(sl.name.trim()) && sl.name !== venue ? sl.name : "";
  const title = venue || sl.name || "Set list";
  const subline = [dateLong, venue ? customName : ""].filter(Boolean).join("  ·  ");
  const footerLeft = [title, dateShort].filter(Boolean).join("  ·  ").toUpperCase();
  const statLine = [
    `${totals.sets} ${totals.sets === 1 ? "set" : "sets"}`,
    `${totals.songs} songs`,
    totals.minutes ? formatDuration(totals.minutes) : "",
  ]
    .filter(Boolean)
    .join("   ·   ")
    .toUpperCase();
  const backups = opts.showBackups ? sl.backups : [];

  const s = R.StyleSheet.create({
    page: {
      backgroundColor: p.page,
      color: p.ink,
      fontFamily: FAMILY.body,
      fontSize: 9,
      paddingTop: MARGIN_TOP,
      paddingBottom: MARGIN_BOTTOM,
      paddingHorizontal: MARGIN_X,
    },
    eyebrow: { fontFamily: FAMILY.mono, fontSize: 7, letterSpacing: 2.4, color: p.muted, textTransform: "uppercase" },
    footer: {
      position: "absolute",
      left: MARGIN_X,
      right: MARGIN_X,
      bottom: 22,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 0.5,
      borderTopColor: p.ruleStrong,
      paddingTop: 6,
    },
    footerText: { fontFamily: FAMILY.mono, fontSize: 6.5, letterSpacing: 1.6, color: p.muted },
    tag: {
      fontFamily: FAMILY.mono,
      fontSize: 5.5,
      letterSpacing: 1,
      color: p.accent,
      borderWidth: 0.6,
      borderColor: p.accent,
      borderRadius: 2,
      paddingHorizontal: 2.5,
      paddingTop: 1.2,
      paddingBottom: 0.6,
      marginLeft: 4,
      marginTop: 1.5,
      textTransform: "uppercase",
    },
  });

  // --- pieces --------------------------------------------------------------

  const Haze = () =>
    p.haze ? (
      <Svg fixed width={pageW} height={pageH} style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <RadialGradient id="haze" cx="0.88" cy="0.02" r="0.62" fx="0.88" fy="0.02">
            <Stop offset="0" stopColor={NEON} stopOpacity={0.16} />
            <Stop offset="1" stopColor={NEON} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="lamp" cx="0.05" cy="1.02" r="0.55" fx="0.05" fy="1.02">
            <Stop offset="0" stopColor="#f2a950" stopOpacity={0.07} />
            <Stop offset="1" stopColor="#f2a950" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={pageW} height={pageH} fill="url(#haze)" />
        <Rect x="0" y="0" width={pageW} height={pageH} fill="url(#lamp)" />
      </Svg>
    ) : null;

  const Bulbs = ({ width, dot = 3.2 }: { width: number; dot?: number }) => {
    const n = Math.max(6, Math.floor(width / 13));
    return (
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 }}>
        {Array.from({ length: n }, (_, i) => (
          <View
            key={i}
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: opts.theme === "print" ? undefined : p.bulb,
              borderWidth: opts.theme === "print" ? 0.6 : 0,
              borderColor: p.bulb,
              opacity: opts.theme === "noir" && i % 3 === 1 ? 0.55 : 1,
            }}
          />
        ))}
      </View>
    );
  };

  /** A rounded frame; in noir it gets concentric "glow" rings, in print a double rule. */
  const Frame = ({ children, radius = 8 }: { children: ReactNode; radius?: number }) => {
    if (opts.theme === "print") {
      return (
        <View style={{ borderWidth: 1.4, borderColor: p.ruleStrong, borderRadius: radius, padding: 2.2 }}>
          <View style={{ borderWidth: 0.6, borderColor: p.accent, borderRadius: radius - 2 }}>{children}</View>
        </View>
      );
    }
    const [g1, g2, g3] = p.glow;
    return (
      <View style={{ borderWidth: 2.5, borderColor: g3, borderRadius: radius + 5, padding: 0 }}>
        <View style={{ borderWidth: 1.5, borderColor: g2, borderRadius: radius + 2.5, padding: 0 }}>
          <View style={{ borderWidth: 1, borderColor: g1, borderRadius: radius + 1 }}>
            <View style={{ borderWidth: 1, borderColor: p.accent, borderRadius: radius }}>{children}</View>
          </View>
        </View>
      </View>
    );
  };

  const nameSize = (base: number, width: number) => {
    // Big Shoulders is condensed: roughly 0.5em per uppercase glyph (with tracking).
    const fit = width / (Math.max(title.length, 1) * 0.5);
    return clamp(Math.min(base, fit), 24, base);
  };
  const marqueeName = (base: number) => {
    const size = nameSize(base, contentW - 60);
    return { size, lines: Math.ceil((title.length * size * 0.5) / (contentW - 60)) };
  };

  const Marquee = ({ nameSize: nameFont }: { nameSize: number }) => (
    <Frame>
      <View style={{ paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9 }}>
        <Bulbs width={contentW - 40} />
        <View style={{ alignItems: "center", paddingTop: 9, paddingBottom: 8 }}>
          <Text style={[s.eyebrow, { color: p.accent, marginBottom: 3 }]}>
            {"—   Set list   —"}
          </Text>
          <Text
            style={{
              fontFamily: FAMILY.display,
              fontWeight: 800,
              fontSize: nameFont,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: p.marquee,
              textAlign: "center",
              lineHeight: 1,
            }}
          >
            {title}
          </Text>
          {subline ? (
            <Text style={{ fontFamily: FAMILY.serif, fontStyle: "italic", fontSize: 11.5, color: p.ink2, marginTop: 5 }}>
              {subline}
            </Text>
          ) : null}
        </View>
        <Bulbs width={contentW - 40} />
      </View>
    </Frame>
  );

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{footerLeft}</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`}
      />
    </View>
  );

  const Tags = ({ item, size = 5.5 }: { item: SetItem; size?: number }) => (
    <>
      {flagTags(item).map((t) => (
        <Text key={t} style={[s.tag, { fontSize: size }]}>
          {t}
        </Text>
      ))}
    </>
  );

  /** One song row. `scale` = title size in pt; `wide` puts the feel inline instead of underneath. */
  const SongRow = ({ item, n, scale, wide, last }: { item: SetItem; n: number | null; scale: number; wide: boolean; last: boolean }) => {
    const credit = creditFor(item, opts);
    const feel = opts.showFeels && item.feel ? item.feel : "";
    const under = [!wide ? feel : "", credit].filter(Boolean);
    const tags = flagTags(item);
    const meta = scale * 0.62;
    return (
      <View
        wrap={false}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: scale * 0.28,
          borderBottomWidth: last ? 0 : 0.5,
          borderBottomColor: p.rule,
        }}
      >
        {n !== null ? (
          <Text
            style={{
              width: scale * (wide ? 1.55 : 1.35),
              fontFamily: FAMILY.mono,
              fontSize: meta,
              color: p.faint,
              paddingTop: scale * 0.3,
            }}
          >
            {String(n).padStart(2, "0")}
          </Text>
        ) : null}
        <View style={{ flex: 1, paddingRight: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <Text style={{ fontFamily: FAMILY.serif, fontSize: scale, color: p.ink, lineHeight: 1.2 }}>{item.title}</Text>
            {tags.length && (under.length === 0 || wide) ? <Tags item={item} size={clamp(scale * 0.45, 5, 8)} /> : null}
          </View>
          {under.length ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 0.5 }}>
              <Text style={{ fontFamily: FAMILY.body, fontSize: meta * 0.95, color: p.muted }}>
                {feel && !wide ? feel : ""}
                {feel && !wide && credit ? "  ·  " : ""}
                {credit ? <Text style={{ fontFamily: FAMILY.serif, fontStyle: "italic" }}>{credit}</Text> : null}
              </Text>
              {tags.length && !wide ? <Tags item={item} size={clamp(scale * 0.45, 5, 8)} /> : null}
            </View>
          ) : null}
          {item.note ? (
            <Text style={{ fontFamily: FAMILY.serif, fontStyle: "italic", fontSize: meta, color: p.key, marginTop: 1 }}>
              {item.note}
            </Text>
          ) : null}
        </View>
        {wide && feel ? (
          <Text style={{ width: scale * 7, fontFamily: FAMILY.body, fontSize: meta, color: p.muted, paddingTop: scale * 0.28 }}>
            {feel}
          </Text>
        ) : null}
        {opts.showKeys ? (
          <Text
            style={{
              width: scale * (wide ? 2.3 : 1.9),
              textAlign: "right",
              fontFamily: FAMILY.mono,
              fontWeight: 600,
              fontSize: meta * 1.05,
              color: p.key,
              paddingTop: scale * 0.26,
            }}
          >
            {item.key ?? ""}
          </Text>
        ) : null}
        {opts.showTimes ? (
          <Text
            style={{
              width: scale * (wide ? 2 : 1.55),
              textAlign: "right",
              fontFamily: FAMILY.mono,
              fontSize: meta,
              color: p.muted,
              paddingTop: scale * 0.3,
            }}
          >
            {item.minutes ? `${Math.round(item.minutes)}′` : ""}
          </Text>
        ) : null}
      </View>
    );
  };

  const SetHeading = ({ name, items, size, compact = false }: { name: string; items: SetItem[]; size: number; compact?: boolean }) => (
    <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: size * 0.25 }} wrap={false}>
      <Text
        style={{
          fontFamily: FAMILY.display,
          fontWeight: 800,
          fontSize: size,
          color: p.accent,
          textTransform: "uppercase",
          letterSpacing: 1,
          lineHeight: 1,
        }}
      >
        {name}
      </Text>
      <View style={{ flex: 1, borderBottomWidth: 0.75, borderBottomColor: p.ruleStrong, marginHorizontal: 7, marginBottom: size * 0.2 }} />
      <Text style={[s.eyebrow, { fontSize: 6.5, letterSpacing: 1.6, marginBottom: size * 0.1 }]}>
        {[compact && opts.showTimes ? "" : `${items.length} ${items.length === 1 ? "song" : "songs"}`, opts.showTimes ? formatDuration(itemsMinutes(items)) : ""]
          .filter(Boolean)
          .join("  ·  ")}
      </Text>
    </View>
  );

  const Backups = ({ size }: { size: number }) =>
    backups.length ? (
      <View wrap={false} style={{ marginTop: 14, flexDirection: "row", alignItems: "flex-start" }}>
        <Text style={[s.eyebrow, { color: p.accent, width: 62, paddingTop: size * 0.2 }]}>Backups</Text>
        <Text style={{ flex: 1, fontFamily: FAMILY.serif, fontStyle: "italic", fontSize: size, color: p.ink2, lineHeight: 1.45 }}>
          {backups.map((b, i) => (
            <Text key={i}>
              {i > 0 ? <Text style={{ color: p.faint }}>{"   /   "}</Text> : null}
              {b.title}
              {opts.showKeys && b.key ? (
                <Text style={{ fontFamily: FAMILY.mono, fontStyle: "normal", fontSize: size * 0.72, color: p.key }}>{`  ${b.key}`}</Text>
              ) : null}
            </Text>
          ))}
        </Text>
      </View>
    ) : null;

  // --- one-page -----------------------------------------------------------

  const OnePage = () => {
    const nSets = Math.max(sl.sets.length, 1);
    const cols = nSets === 4 ? 2 : Math.min(nSets, 3);
    const rows = Math.ceil(nSets / cols);
    const gap = 20;
    const colW = (contentW - gap * (cols - 1)) / cols;
    const wide = colW > 330;
    const hasUnder = (it: SetItem) => (!wide && opts.showFeels && !!it.feel) || !!creditFor(it, opts);

    // Estimate the tallest column in each row and pick the largest title size that fits.
    // react-pdf can't measure text up front, so this errs on the generous side.
    const headerH = (name: { size: number; lines: number }) => 128 + name.lines * name.size + (subline ? 0 : -18);
    const availFor = (name: { size: number; lines: number }) =>
      pageH - MARGIN_TOP - MARGIN_BOTTOM - headerH(name) - (backups.length ? 48 : 0);
    const titleWidth = (scale: number) =>
      colW - scale * (wide ? 1.55 : 1.35) - (opts.showKeys ? scale * (wide ? 2.3 : 1.9) : 0) - (opts.showTimes ? scale * (wide ? 2 : 1.55) : 0) - (wide && opts.showFeels ? scale * 7 : 0) - 4;
    const itemH = (it: SetItem, scale: number) => {
      const tags = flagTags(it).length && !hasUnder(it) ? 6 * scale * 0.5 : 0;
      const lines = Math.max(1, Math.ceil(((it.title.length + tags / (scale * 0.5)) * scale * 0.5) / titleWidth(scale)));
      const meta = scale * 0.62;
      const noteLines = it.note ? Math.ceil((it.note.length * meta * 0.5) / titleWidth(scale)) : 0;
      return scale * 0.56 + 0.5 + lines * scale * 1.2 + (hasUnder(it) ? meta * 1.45 : 0) + noteLines * meta * 1.35;
    };
    const rowHeight = (scale: number) => {
      let total = 0;
      for (let r = 0; r < rows; r++) {
        const inRow = sl.sets.slice(r * cols, r * cols + cols);
        const h = Math.max(
          0,
          ...inRow.map(
            (set) =>
              scale * 1.9 * 1.25 + 16 + set.items.reduce((sum, it) => sum + itemH(it, scale), 0),
          ),
        );
        total += h + (r > 0 ? 18 : 0);
      }
      return total;
    };
    const MIN_SCALE = 8.5;
    const fitScale = (avail: number) => {
      let sc = cols === 1 ? 16 : cols === 2 ? 14 : 12;
      while (sc > MIN_SCALE && rowHeight(sc) > avail) sc -= 0.25;
      return sc;
    };
    // Try the full marquee first, then a compact one before giving up on a single sheet.
    let name = marqueeName(46);
    let scale = fitScale(availFor(name));
    if (rowHeight(scale) > availFor(name) || scale < 10) {
      const compact = marqueeName(30);
      const sc = fitScale(availFor(compact));
      if (sc > scale || rowHeight(scale) > availFor(name)) {
        name = compact;
        scale = sc;
      }
    }
    const fits = rowHeight(scale) <= availFor(name);
    // Flowing onto several pages: no need to squeeze, use a comfortable size.
    if (!fits) {
      scale = 12;
      name = marqueeName(46);
    }

    const setBlock = (set: SetList["sets"][number], i: number, width: number | undefined, isWide: boolean) => (
      <View key={i} style={{ width, marginBottom: 16 }}>
        <SetHeading name={set.name || `Set ${i + 1}`} items={set.items} size={scale * 1.9} compact={(width ?? contentW) < 200} />
        {set.items.map((it, j) => (
          <SongRow key={j} item={it} n={j + 1} scale={scale} wide={isWide} last={j === set.items.length - 1} />
        ))}
      </View>
    );

    return (
      <Page size={size} style={s.page}>
        <Haze />
        <Marquee nameSize={name.size} />
        <Text style={[s.eyebrow, { textAlign: "center", marginTop: 9, marginBottom: 16, color: p.muted }]}>{statLine}</Text>
        {fits ? (
          Array.from({ length: rows }, (_, r) => (
            <View key={r} style={{ flexDirection: "row", gap }}>
              {sl.sets.slice(r * cols, r * cols + cols).map((set, k) => setBlock(set, r * cols + k, colW, wide))}
            </View>
          ))
        ) : (
          // Too long for one sheet: stack the sets full width and let them flow onto more pages.
          sl.sets.map((set, i) => setBlock(set, i, undefined, true))
        )}
        <Backups size={clamp(scale * 0.95, 9, 12)} />
        <Footer />
      </Page>
    );
  };

  // --- set-per-page -------------------------------------------------------

  const SetPage = ({ index }: { index: number }) => {
    const set = sl.sets[index];
    const items = set.items;
    const name = set.name || `Set ${index + 1}`;
    const isLast = index === sl.sets.length - 1;
    const hasUnder = (it: SetItem) => (opts.showFeels && !!it.feel) || !!creditFor(it, opts);
    const avail = pageH - MARGIN_TOP - MARGIN_BOTTOM - 150 - (isLast && backups.length ? 56 : 0);
    // Row height is ~1.85x the title size, plus a meta line (~0.5x, min 8pt) and notes.
    const rowsH = (scale: number) =>
      items.reduce((sum, it) => {
        const meta = clamp(scale * 0.5, 8, 12) * 1.35;
        const lines = Math.max(1, Math.ceil((it.title.length * scale * 0.5) / (contentW - scale * 6)));
        return sum + scale * 0.6 + lines * scale * 1.2 + 1 + (hasUnder(it) ? meta : 0) + (it.note ? meta : 0);
      }, 0);
    let scale = 28;
    while (scale > 11 && rowsH(scale) > avail) scale -= 0.5;
    const mins = itemsMinutes(items);

    return (
      <Page size={size} style={s.page}>
        <Haze />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={[s.eyebrow, { flex: 1, marginRight: 16, maxLines: 1, textOverflow: "ellipsis" }]}>
            <Text style={{ fontFamily: FAMILY.body, fontWeight: 700, fontSize: 9, letterSpacing: 0.6, color: p.ink }}>{title.toUpperCase()}</Text>
            {dateShort ? `   ·   ${dateShort}` : ""}
          </Text>
          <Text style={[s.eyebrow, { color: p.accent, flexShrink: 0 }]}>{`Set ${index + 1} of ${sl.sets.length}`}</Text>
        </View>
        <Frame radius={7}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <Bulbs width={contentW - 44} dot={2.8} />
            <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
              <Text
                style={{
                  flex: 1,
                  fontFamily: FAMILY.display,
                  fontWeight: 800,
                  fontSize: 54,
                  lineHeight: 1,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: p.marquee,
                }}
              >
                {name}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                {opts.showTimes && mins ? (
                  <Text style={{ fontFamily: FAMILY.display, fontWeight: 700, fontSize: 28, color: p.ink, lineHeight: 1 }}>
                    {formatDuration(mins).toUpperCase()}
                  </Text>
                ) : null}
                <Text style={[s.eyebrow, { marginTop: 3 }]}>{`${items.length} ${items.length === 1 ? "song" : "songs"}`}</Text>
              </View>
            </View>
            <Bulbs width={contentW - 44} dot={2.8} />
          </View>
        </Frame>
        <View style={{ marginTop: 14 }}>
          {items.map((it, j) => (
            <BigRow key={j} item={it} n={j + 1} scale={scale} last={j === items.length - 1} />
          ))}
        </View>
        {isLast ? <Backups size={12} /> : null}
        <Footer />
      </Page>
    );
  };

  /** Music-stand row: big display numeral, big serif title. */
  const BigRow = ({ item, n, scale, last }: { item: SetItem; n: number; scale: number; last: boolean }) => {
    const credit = creditFor(item, opts);
    const feel = opts.showFeels && item.feel ? item.feel : "";
    const meta = clamp(scale * 0.5, 8, 12);
    return (
      <View
        wrap={false}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: scale * 0.3,
          borderBottomWidth: last ? 0 : 0.5,
          borderBottomColor: p.rule,
        }}
      >
        <Text
          style={{
            width: scale * 1.7,
            fontFamily: FAMILY.display,
            fontWeight: 700,
            fontSize: scale * 1.05,
            color: p.accent,
            lineHeight: 1,
          }}
        >
          {String(n)}
        </Text>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <Text style={{ fontFamily: FAMILY.serif, fontSize: scale, color: p.ink, lineHeight: 1.15 }}>{item.title}</Text>
            <Tags item={item} size={clamp(scale * 0.32, 6, 9)} />
          </View>
          {feel || credit ? (
            <Text style={{ fontFamily: FAMILY.body, fontSize: meta, color: p.muted, marginTop: 1 }}>
              {feel}
              {feel && credit ? "  ·  " : ""}
              {credit ? <Text style={{ fontFamily: FAMILY.serif, fontStyle: "italic" }}>{credit}</Text> : null}
            </Text>
          ) : null}
          {item.note ? (
            <Text style={{ fontFamily: FAMILY.serif, fontStyle: "italic", fontSize: meta, color: p.key, marginTop: 1 }}>
              {item.note}
            </Text>
          ) : null}
        </View>
        {opts.showKeys ? (
          <Text
            style={{
              minWidth: scale * 2.2,
              textAlign: "right",
              fontFamily: FAMILY.mono,
              fontWeight: 600,
              fontSize: scale * 0.72,
              color: p.key,
            }}
          >
            {item.key ?? ""}
          </Text>
        ) : null}
        {opts.showTimes ? (
          <Text style={{ width: scale * 1.9, textAlign: "right", fontFamily: FAMILY.mono, fontSize: meta, color: p.muted }}>
            {item.minutes ? `${Math.round(item.minutes)}′` : ""}
          </Text>
        ) : null}
      </View>
    );
  };

  // --- plain -------------------------------------------------------------
  // Just the set list: the venue and date, then each set's numbered titles. None of the extras.

  const PlainPage = () => (
    <Page size={size} style={[s.page, { paddingBottom: MARGIN_TOP }]}>
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontFamily: FAMILY.body, fontWeight: 700, fontSize: 20, color: p.ink }}>{title}</Text>
        {dateLong ? <Text style={{ fontFamily: FAMILY.body, fontSize: 11, color: p.ink2, marginTop: 3 }}>{dateLong}</Text> : null}
      </View>
      {sl.sets.map((set, i) => (
        <View key={i} style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: FAMILY.body, fontWeight: 700, fontSize: 12, color: p.ink, marginBottom: 6 }} minPresenceAhead={40}>
            {set.name || `Set ${i + 1}`}
          </Text>
          {set.items.map((it, j) => (
            <View key={j} wrap={false} style={{ flexDirection: "row", paddingVertical: 2.5 }}>
              <Text style={{ width: 22, fontFamily: FAMILY.body, fontSize: 12, color: p.muted }}>{`${j + 1}.`}</Text>
              <Text style={{ flex: 1, fontFamily: FAMILY.body, fontSize: 12, color: p.ink }}>{it.title}</Text>
            </View>
          ))}
        </View>
      ))}
    </Page>
  );

  // --- stage floor -------------------------------------------------------
  // One set per page, titles only, as big and bold as the page allows: read from a few feet away.

  const StagePage = ({ index }: { index: number }) => {
    const set = sl.sets[index];
    const items = set.items;
    const name = set.name || `Set ${index + 1}`;
    const avail = pageH - MARGIN_TOP - MARGIN_BOTTOM - 64;
    const keyW = (scale: number) => (opts.showKeys ? scale * 2.1 : 0);
    const rowsH = (scale: number) =>
      items.reduce((sum, it) => {
        const lines = Math.max(1, Math.ceil((it.title.length * scale * 0.5) / (contentW - scale * 1.4 - keyW(scale))));
        return sum + lines * scale * 1.02 + scale * 0.42 + 1;
      }, 0);
    let scale = 56;
    while (scale > 16 && rowsH(scale) > avail) scale -= 1;
    return (
      <Page size={size} style={s.page}>
        <Haze />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
          <Text style={{ flex: 1, marginRight: 16, fontFamily: FAMILY.body, fontWeight: 700, fontSize: 11, color: p.ink, maxLines: 1, textOverflow: "ellipsis" }}>
            {title.toUpperCase()}
            <Text style={{ fontWeight: 400, color: p.muted }}>{dateShort ? `   ·   ${dateShort}` : ""}</Text>
          </Text>
          <Text style={{ fontFamily: FAMILY.display, fontWeight: 800, fontSize: 20, color: p.accent, textTransform: "uppercase", letterSpacing: 1 }}>
            {name}
            <Text style={{ fontFamily: FAMILY.mono, fontWeight: 400, fontSize: 7, letterSpacing: 1.6, color: p.muted }}>{`   ${index + 1} OF ${sl.sets.length}`}</Text>
          </Text>
        </View>
        <View style={{ borderTopWidth: 2, borderTopColor: p.ruleStrong, paddingTop: 4 }}>
          {items.map((it, j) => (
            <View key={j} wrap={false} style={{ flexDirection: "row", alignItems: "center", paddingVertical: scale * 0.2, borderBottomWidth: j === items.length - 1 ? 0 : 0.6, borderBottomColor: p.rule }}>
              <Text style={{ width: scale * 1.4, fontFamily: FAMILY.display, fontWeight: 700, fontSize: scale * 0.7, color: p.accent, lineHeight: 1 }}>{String(j + 1)}</Text>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                <Text style={{ fontFamily: FAMILY.display, fontWeight: 800, fontSize: scale, color: p.ink, textTransform: "uppercase", lineHeight: 1.02, letterSpacing: 0.5 }}>
                  {it.title}
                </Text>
                <Tags item={it} size={clamp(scale * 0.26, 7, 11)} />
              </View>
              {opts.showKeys ? (
                <Text style={{ width: keyW(scale), textAlign: "right", fontFamily: FAMILY.mono, fontWeight: 600, fontSize: scale * 0.55, color: p.key }}>{it.key ?? ""}</Text>
              ) : null}
            </View>
          ))}
        </View>
        <Footer />
      </Page>
    );
  };

  // --- compact -----------------------------------------------------------
  // Every set in one tight column; flows onto more pages only when it has to.

  const CompactPage = () => (
    <Page size={size} style={s.page}>
      <Haze />
      <View style={{ borderBottomWidth: 1.4, borderBottomColor: p.ruleStrong, paddingBottom: 8, marginBottom: 10 }}>
        <Text style={[s.eyebrow, { color: p.accent, marginBottom: 3 }]}>Set list</Text>
        <Text style={{ fontFamily: FAMILY.display, fontWeight: 800, fontSize: 28, lineHeight: 1, color: p.marquee, textTransform: "uppercase", letterSpacing: 1 }}>{title}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontFamily: FAMILY.serif, fontStyle: "italic", fontSize: 10.5, color: p.ink2 }}>{subline}</Text>
          <Text style={[s.eyebrow, { fontSize: 6.5 }]}>{statLine}</Text>
        </View>
      </View>
      {sl.sets.map((set, i) => (
        <View key={i} style={{ marginBottom: 10 }}>
          <SetHeading name={set.name || `Set ${i + 1}`} items={set.items} size={14} />
          {set.items.map((it, j) => (
            <SongRow key={j} item={it} n={j + 1} scale={9.5} wide last={j === set.items.length - 1} />
          ))}
        </View>
      ))}
      <Backups size={9} />
      <Footer />
    </Page>
  );

  const docTitle = [title, dateShort].filter(Boolean).join(" · ");
  return (
    <Document title={`${docTitle} — Set list`} author="Set list" subject="Set list" creator="Set list" producer="Set list">
      {opts.layout === "set-per-page" && sl.sets.length > 0 ? (
        sl.sets.map((_, i) => <SetPage key={i} index={i} />)
      ) : opts.layout === "stage" && sl.sets.length > 0 ? (
        sl.sets.map((_, i) => <StagePage key={i} index={i} />)
      ) : opts.layout === "compact" ? (
        <CompactPage />
      ) : opts.layout === "plain" ? (
        <PlainPage />
      ) : (
        <OnePage />
      )}
    </Document>
  ) as ReactElement<DocumentProps>;
}

/** Render the PDF in the browser and download it, e.g. "2026-10-03-blue-note-set-list.pdf". */
export async function downloadSetListPdf(sl: SetList, opts: Partial<PdfOptions> = {}): Promise<void> {
  const R = await import("@react-pdf/renderer");
  const blob = await R.pdf(createSetListDocument(R, sl, opts)).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(sl, "pdf");
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser a moment to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
