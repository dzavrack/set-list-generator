"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SetList, Song } from "@/lib/types";
import { TEXT_FORMATS, formatSetList, formatDuration, setListTotals, type TextFormat } from "@/lib/export/text";
import {
  DEFAULT_PDF_OPTIONS,
  PDF_LAYOUTS,
  PDF_THEMES,
  downloadSetListPdf,
  type PdfLayout,
  type PdfOptions,
  type PdfTheme,
} from "@/lib/export/pdf";
import { readKey, writeKey } from "@/lib/storage";
import { GENRES } from "@/lib/genres";
import { Check, Copy, Download, FileText, Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { Card, Tabs } from "@/components/ui/Page";
import { Segmented } from "@/components/ui/Segmented";
import { cx } from "@/components/ui/cx";

type Tab = "text" | "pdf";
type PdfPrefs = Omit<PdfOptions, "songs" | "fontsUrl" | "pageSize">;

interface ExportPrefs {
  tab: Tab;
  format: TextFormat;
  includeBackups: boolean;
  includeNotes: boolean;
  pdf: PdfPrefs;
}

const PREFS_KEY = "export-prefs";
const DEFAULT_PREFS: ExportPrefs = {
  tab: "text",
  format: "bandleader",
  includeBackups: true,
  includeNotes: false,
  pdf: {
    theme: DEFAULT_PDF_OPTIONS.theme,
    layout: DEFAULT_PDF_OPTIONS.layout,
    showKeys: DEFAULT_PDF_OPTIONS.showKeys,
    showFeels: DEFAULT_PDF_OPTIONS.showFeels,
    showTimes: DEFAULT_PDF_OPTIONS.showTimes,
    showBackups: DEFAULT_PDF_OPTIONS.showBackups,
    showCredits: DEFAULT_PDF_OPTIONS.showCredits,
  },
};

function loadPrefs(): ExportPrefs {
  const saved = readKey<Partial<ExportPrefs> | null>(PREFS_KEY, null);
  if (!saved || typeof saved !== "object") return DEFAULT_PREFS;
  return { ...DEFAULT_PREFS, ...saved, pdf: { ...DEFAULT_PREFS.pdf, ...(saved.pdf ?? {}) } };
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to the legacy path (older Safari, insecure contexts).
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Copy failed");
}

export function ExportDialog({
  setList,
  songs,
  open,
  onClose,
}: {
  setList: SetList;
  songs?: Map<string, Song>;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Let React own the open state: Esc asks the parent to close.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-0 max-h-none max-w-none bg-transparent p-0 text-ink backdrop:bg-[rgb(6_4_5/0.72)] backdrop:backdrop-blur-[3px]",
        "fixed inset-0 h-dvh w-full sm:m-auto sm:h-fit sm:max-h-[92dvh] sm:w-[min(760px,94vw)]",
      )}
    >
      {open && <ExportPanel setList={setList} songs={songs} onClose={onClose} titleId={titleId} />}
    </dialog>
  );
}

function ExportPanel({
  setList,
  songs,
  onClose,
  titleId,
}: {
  setList: SetList;
  songs?: Map<string, Song>;
  onClose: () => void;
  titleId: string;
}) {
  const [prefs, setPrefs] = useState<ExportPrefs>(loadPrefs);
  const tabsRef = useRef<HTMLDivElement>(null);
  const update = (patch: Partial<ExportPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writeKey(PREFS_KEY, next);
      return next;
    });
  const updatePdf = (patch: Partial<PdfPrefs>) => update({ pdf: { ...prefs.pdf, ...patch } });

  const totals = setListTotals(setList);
  const noun = GENRES[setList.genre]?.noun ?? "song";
  const panelId = `${titleId}-panel`;

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    update({ tab: prefs.tab === "text" ? "pdf" : "text" });
    requestAnimationFrame(() => tabsRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus());
  };

  return (
    <div className="relative flex h-full max-h-dvh flex-col overflow-hidden bg-panel shadow-[0_30px_90px_rgb(0_0_0/0.85)] sm:max-h-[92dvh] sm:rounded-[20px] sm:border sm:border-line-strong">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(closest-side,rgb(255_43_69/0.16),transparent)] blur-2xl" />

      <div className="relative flex items-start justify-between gap-4 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-5 sm:px-8 sm:pt-7">
        <div className="min-w-0">
          <p className="label">Export</p>
          <h2 id={titleId} tabIndex={-1} autoFocus className="mt-2 truncate outline-none focus-visible:outline-none font-serif text-[34px] leading-none text-ink sm:text-[40px]">
            {setList.name || "Set list"}
          </h2>
          <p className="tabular mt-2.5 font-mono text-xs text-muted">
            {totals.sets} {totals.sets === 1 ? "set" : "sets"} · {totals.songs} {totals.songs === 1 ? noun : `${noun}s`}
            {totals.minutes ? ` · ${formatDuration(totals.minutes)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close export"
          className="-mt-1 -mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </div>

      <div ref={tabsRef} onKeyDown={onTabKey} className="relative px-5 sm:px-8">
        <Tabs
          label="Export type"
          value={prefs.tab}
          onChange={(tab) => update({ tab })}
          tabs={[
            { value: "text", label: <span className="inline-flex items-center gap-2"><Copy className="h-4 w-4" strokeWidth={1.75} />Copy text</span> },
            { value: "pdf", label: <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" strokeWidth={1.75} />PDF</span> },
          ]}
        />
      </div>

      <div id={panelId} role="tabpanel" aria-label={prefs.tab === "text" ? "Copy text" : "PDF"} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {prefs.tab === "text" ? (
          <TextTab setList={setList} songs={songs} prefs={prefs} update={update} />
        ) : (
          <PdfTab setList={setList} songs={songs} prefs={prefs.pdf} update={updatePdf} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="label mb-3">{label}</legend>
      {children}
    </fieldset>
  );
}

/** Sticky action bar at the foot of each tab. */
function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto flex items-center gap-3 border-t border-line bg-panel/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-8">
      {children}
    </div>
  );
}

function TextTab({
  setList,
  songs,
  prefs,
  update,
}: {
  setList: SetList;
  songs?: Map<string, Song>;
  prefs: ExportPrefs;
  update: (p: Partial<ExportPrefs>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = useMemo(
    () => formatSetList(setList, prefs.format, { includeBackups: prefs.includeBackups, includeNotes: prefs.includeNotes, songs }),
    [setList, prefs.format, prefs.includeBackups, prefs.includeNotes, songs],
  );
  const info = TEXT_FORMATS.find((f) => f.value === prefs.format) ?? TEXT_FORMATS[0];
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    setError(null);
    try {
      await copyText(text);
      setCopied(true);
    } catch {
      setError("Couldn't reach the clipboard. Select the text below and copy it by hand.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: setList.name || "Set list", text });
    } catch {
      // User cancelled the share sheet: nothing to do.
    }
  };

  const noun = GENRES[setList.genre]?.noun ?? "song";
  const serifPreview = prefs.format === "stage" || prefs.format === "titles";
  const lines = text.split("\n").length;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-7 px-5 py-6 sm:px-8">
        <Section label="Format">
          <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0">
            <Segmented
              label="Text format"
              value={prefs.format}
              onChange={(format) => update({ format })}
              options={TEXT_FORMATS.map((f) => ({ value: f.value, label: <span className="whitespace-nowrap">{f.label}</span> }))}
            />
          </div>
          <p className="mt-2.5 text-[13px] text-muted">{info.description}</p>
        </Section>

        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <Toggle checked={prefs.includeBackups} onChange={(v) => update({ includeBackups: v })} label="Include backups" hint={`Spare ${noun}s listed after the sets`} />
          <Toggle checked={prefs.includeNotes} onChange={(v) => update({ includeNotes: v })} label="Include notes" hint={`Your notes under each ${noun}`} />
        </div>

        <Card className="overflow-hidden bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-5">
            <span className="label">Preview</span>
            <span className="tabular font-mono text-[11px] text-faint">
              {lines} {lines === 1 ? "line" : "lines"} · {text.length.toLocaleString()} chars
            </span>
          </div>
          <pre
            tabIndex={0}
            aria-label="Export preview"
            className={cx(
              "max-h-[40dvh] min-h-40 overflow-auto px-4 py-4 whitespace-pre text-ink-2 focus-visible:outline-offset-[-2px] sm:max-h-[320px] sm:px-5",
              serifPreview ? "font-serif text-[16px] leading-relaxed text-ink" : "font-mono text-[12px] leading-[1.7]",
            )}
          >
            {text}
          </pre>
        </Card>

        {error && (
          <p role="alert" className="rounded-[10px] border border-[rgb(255_43_69/0.35)] bg-[rgb(255_43_69/0.08)] px-3.5 py-2.5 text-sm text-neon-hot">
            {error}
          </p>
        )}
      </div>

      <ActionBar>
        <Button variant="primary" size="lg" className="flex-1 sm:min-w-48 sm:flex-none" onClick={copy}>
          {copied ? <Check strokeWidth={2} /> : <Copy strokeWidth={1.75} />}
          {copied ? "Copied" : `Copy ${info.label.toLowerCase()}`}
        </Button>
        {canShare && (
          <Button size="lg" onClick={share}>
            <Share2 strokeWidth={1.75} />
            Share
          </Button>
        )}
        <span aria-live="polite" className="sr-only">
          {copied ? "Copied to clipboard" : ""}
        </span>
      </ActionBar>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** A tiny sketch of the PDF page, so the choice is visual. */
function ThemePreview({ theme }: { theme: PdfTheme }) {
  const noir = theme === "noir";
  return (
    <div
      aria-hidden
      className={cx(
        "relative aspect-[8.5/11] w-[76px] shrink-0 overflow-hidden rounded-[3px] p-[7px] shadow-[0_8px_22px_rgb(0_0_0/0.55)]",
        noir ? "bg-[#0a0708] ring-1 ring-white/[0.06]" : "bg-white",
      )}
    >
      {noir && <div className="pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full bg-[radial-gradient(circle,rgb(255_43_69/0.35),transparent_70%)]" />}
      <div
        className={cx(
          "rounded-[3px] border px-1 py-[3px] text-center",
          noir ? "border-neon shadow-[0_0_6px_var(--neon-glow)]" : "border-[#141112] outline outline-[0.5px] outline-offset-[-2.5px] outline-[#d1122b]",
        )}
      >
        <div className={cx("text-[7px] leading-none font-bold tracking-[0.08em]", noir ? "text-[#ff5468]" : "text-[#141112]")}>SET LIST</div>
        <div className={cx("mx-auto mt-[2px] h-[1.5px] w-6 rounded", noir ? "bg-ink-2/40" : "bg-black/25")} />
      </div>
      <div className="mt-[6px] grid grid-cols-2 gap-[5px]">
        {[0, 1].map((c) => (
          <div key={c}>
            <div className="mb-[3px] flex items-center gap-[2px]">
              <span className={cx("h-[2px] w-[7px] rounded-full", noir ? "bg-neon" : "bg-[#d1122b]")} />
              <span className={cx("h-px flex-1", noir ? "bg-white/15" : "bg-black/40")} />
            </div>
            {[0, 1, 2, 3, 4, 5].map((r) => (
              <div key={r} className="mb-[3px] flex items-center gap-[2px]">
                <span className={cx("h-[2px] rounded-full", noir ? "bg-ink/70" : "bg-black/75")} style={{ width: `${55 + ((r * 17 + c * 11) % 30)}%` }} />
                <span className={cx("ml-auto h-[2px] w-[4px] rounded-full", noir ? "bg-ink-2/60" : "bg-black")} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LayoutPreview({ layout }: { layout: PdfLayout }) {
  return (
    <div aria-hidden className="flex h-11 w-[76px] shrink-0 items-center justify-center gap-1">
      {layout === "one-page" ? (
        <div className="grid h-11 w-9 grid-cols-2 gap-[3px] rounded-[3px] border border-line-strong bg-bg p-[4px]">
          {[0, 1].map((c) => (
            <div key={c} className="flex flex-col gap-[2px]">
              {[0, 1, 2, 3, 4].map((r) => (
                <span key={r} className="h-[2px] rounded-full bg-ink-2/60" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        [0, 1].map((p) => (
          <div key={p} className="flex h-11 w-8 flex-col gap-[4px] rounded-[3px] border border-line-strong bg-bg p-[4px]">
            <span className="h-[3px] w-3.5 rounded-sm bg-neon/80" />
            {[0, 1, 2].map((r) => (
              <span key={r} className="h-[3px] rounded-full bg-ink-2/70" />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/** Radio card used for PDF theme and layout. */
function OptionCard({ on, onSelect, preview, title, description }: { on: boolean; onSelect: () => void; preview: React.ReactNode; title: string; description: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      className={cx(
        "relative flex w-full items-center gap-4 rounded-2xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-150 sm:p-4",
        on
          ? "border-[rgb(255_43_69/0.55)] bg-surface-2"
          : "border-line bg-surface/80 hover:border-line-strong hover:bg-surface-2/80",
      )}
    >
      {preview}
      <span className="flex min-w-0 flex-1 flex-col gap-1 pr-5">
        <span className={cx("text-[15px] font-medium", on ? "text-ink" : "text-ink-2")}>{title}</span>
        <span className="text-[13px] leading-snug text-muted">{description}</span>
      </span>
      <span
        aria-hidden
        className={cx(
          "absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full border transition-colors",
          on ? "border-neon bg-neon text-white" : "border-line-strong",
        )}
      >
        {on && <Check className="h-3 w-3" strokeWidth={2.5} />}
      </span>
    </button>
  );
}

function PdfTab({
  setList,
  songs,
  prefs,
  update,
}: {
  setList: SetList;
  songs?: Map<string, Song>;
  prefs: PdfPrefs;
  update: (p: Partial<PdfPrefs>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Warm up the renderer while the user is choosing options.
  useEffect(() => {
    void import("@react-pdf/renderer").catch(() => {});
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2400);
    return () => clearTimeout(t);
  }, [done]);

  const hasCredits = useMemo(() => {
    if (!songs) return false;
    const items = [...setList.sets.flatMap((s) => s.items), ...setList.backups];
    return items.some((it) => {
      const s = songs.get(it.songId);
      return !!(s && (s.composer || s.artist || s.publishYear || s.year));
    });
  }, [songs, setList]);
  const hasFeels = setList.sets.some((s) => s.items.some((it) => it.feel));
  const hasKeys = setList.sets.some((s) => s.items.some((it) => it.key));

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadSetListPdf(setList, { ...prefs, showKeys: prefs.showKeys && hasKeys, showCredits: prefs.showCredits && hasCredits, songs });
      setDone(true);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error && /font/i.test(e.message)
          ? "Couldn't load the PDF fonts. Check your connection and try again."
          : "Something went wrong building the PDF. Try again, or use Copy text instead.",
      );
    } finally {
      setBusy(false);
    }
  };

  const empty = setList.sets.every((s) => s.items.length === 0);
  const noun = GENRES[setList.genre]?.noun ?? "song";
  const pages = prefs.layout === "one-page" ? "1 page" : `${setList.sets.length} ${setList.sets.length === 1 ? "page" : "pages"}`;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-7 px-5 py-6 sm:px-8">
        <Section label="Theme">
          <div role="radiogroup" aria-label="PDF theme" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PDF_THEMES.map((t) => (
              <OptionCard key={t.value} on={prefs.theme === t.value} onSelect={() => update({ theme: t.value })} preview={<ThemePreview theme={t.value} />} title={t.label} description={t.description} />
            ))}
          </div>
        </Section>

        <Section label="Layout">
          <div role="radiogroup" aria-label="PDF layout" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PDF_LAYOUTS.map((l) => (
              <OptionCard key={l.value} on={prefs.layout === l.value} onSelect={() => update({ layout: l.value })} preview={<LayoutPreview layout={l.value} />} title={l.label} description={l.description} />
            ))}
          </div>
        </Section>

        <Section label="Show on the page">
          <Card className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
            <Toggle checked={prefs.showKeys && hasKeys} disabled={!hasKeys} onChange={(v) => update({ showKeys: v })} label="Keys" hint={hasKeys ? `The key you call each ${noun} in` : "No keys set yet"} />
            <Toggle checked={prefs.showFeels} onChange={(v) => update({ showFeels: v })} label="Feels" hint={hasFeels ? "Swing, ballad, bossa and so on" : "No feels set yet"} />
            <Toggle checked={prefs.showTimes} onChange={(v) => update({ showTimes: v })} label="Times" hint={`Minutes per ${noun} and per set`} />
            <Toggle
              checked={prefs.showBackups}
              onChange={(v) => update({ showBackups: v })}
              label="Backups"
              hint={setList.backups.length ? `${setList.backups.length} backup ${setList.backups.length === 1 ? noun : `${noun}s`}` : "No backups in this list"}
            />
            <Toggle
              checked={prefs.showCredits && hasCredits}
              disabled={!hasCredits}
              onChange={(v) => update({ showCredits: v })}
              label="Credits"
              hint={hasCredits ? "Composer and year under each title" : `No composer info for these ${noun}s yet`}
            />
          </Card>
        </Section>

        {error && (
          <p role="alert" className="rounded-[10px] border border-[rgb(255_43_69/0.35)] bg-[rgb(255_43_69/0.08)] px-3.5 py-2.5 text-sm text-neon-hot">
            {error}
          </p>
        )}
      </div>

      <ActionBar>
        <Button variant="primary" size="lg" className="flex-1 sm:min-w-52 sm:flex-none" onClick={download} disabled={busy || empty} aria-busy={busy}>
          {busy ? <Loader2 className="animate-spin" strokeWidth={2} /> : done ? <Check strokeWidth={2} /> : <Download strokeWidth={1.75} />}
          {busy ? "Building PDF…" : done ? "Downloaded" : "Download PDF"}
        </Button>
        <span className="tabular hidden font-mono text-xs text-muted sm:inline">
          {empty ? "Add songs to export" : `${PDF_THEMES.find((t) => t.value === prefs.theme)?.label ?? prefs.theme} · ${pages} · Letter`}
        </span>
        <span aria-live="polite" className="sr-only">
          {busy ? "Building PDF" : done ? "PDF downloaded" : ""}
        </span>
      </ActionBar>
    </div>
  );
}
