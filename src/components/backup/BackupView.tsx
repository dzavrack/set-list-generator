"use client";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Download, FileJson, HardDrive, ShieldAlert, Trash2, Upload, X } from "lucide-react";
import { clearAll, exportBackup, importBackup, storedBytes } from "@/lib/backup";
import { usePracticeLog } from "@/lib/practice";
import { useBooks, useCustomSongs, useRepertoire, useSetLists } from "@/lib/state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/Page";
import { statusDot } from "@/components/ui/Status";
import { toast } from "@/components/ui/Toast";
import { cx } from "@/components/ui/cx";

const CONFIRM_PHRASE = "start fresh";
const noop = () => () => {};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatMinutes(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h}h ${r}m` : `${h}h`;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function BackupView() {
  const { rep } = useRepertoire();
  const [setLists] = useSetLists();
  const [custom] = useCustomSongs();
  const [books] = useBooks();
  const [log] = usePracticeLog();

  const stats = useMemo(() => {
    let sorted = 0, know = 0;
    for (const e of Object.values(rep)) {
      if (e?.status) sorted++;
      if (e?.status === "know") know++;
    }
    const minutes = log.reduce((a, s) => a + (s.minutes || 0), 0);
    const last = setLists.reduce<string | null>((a, l) => (!a || l.updatedAt > a ? l.updatedAt : a), null);
    return { sorted, know, minutes, last };
  }, [rep, log, setLists]);

  // Recomputed on every render, so it follows the hooks above. Null on the server.
  const bytes = useSyncExternalStore(noop, storedBytes, () => null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Backup"
        description="Everything lives in this browser on this device. Save a copy now and then, or to move your book to another computer."
      />

      <section aria-label="What's stored" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Songs sorted" dot={statusDot.know} tone="know" value={stats.sorted.toLocaleString()} sub={`${stats.know.toLocaleString()} ready for the stand`} />
        <StatCard label="Set lists saved" tone="accent" value={setLists.length} sub={stats.last ? `Last on ${shortDate(stats.last)}` : "None saved yet"} />
        <StatCard label="Your own songs" value={custom.length} sub={books.length ? `Plus ${books.length} imported ${books.length === 1 ? "list" : "lists"}` : "Added by hand or imported"} />
        <StatCard label="Practice sessions" value={log.length} sub={stats.minutes ? `${formatMinutes(stats.minutes)} in the woodshed` : "Nothing logged yet"} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SaveCard bytes={bytes} />
        <RestoreCard />
      </div>

      <DangerCard />
    </div>
  );
}

function SaveCard({ bytes }: { bytes: number | null }) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader title="Save a backup" description="One small file with every status, set list, song, rule and practice log." />
      <div className="flex flex-1 flex-col gap-5 px-6 py-5">
        <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface-2/60 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface">
            <FileJson className="h-4 w-4 text-ink-2" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span suppressHydrationWarning className="block truncate font-mono text-[13px] text-ink">gig-book-backup-{new Date().toISOString().slice(0, 10)}.json</span>
            <span className="tabular block text-xs text-muted">{bytes == null ? "Measuring…" : `About ${formatBytes(bytes)}`}</span>
          </span>
        </div>
        <p className="text-[13px] text-muted">Keep it somewhere safe: email it to yourself, or drop it in a cloud folder.</p>
        <div className="mt-auto">
          <Button
            variant="primary"
            onClick={() => {
              exportBackup();
              toast("Backup saved");
            }}
          >
            <Download strokeWidth={1.75} />
            Save a backup
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RestoreCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const pick = (f: File) => {
    setError(null);
    setPending(f);
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      toast(await importBackup(pending));
      setPending(null);
    } catch {
      setError("That file isn't a Gig Book backup. Pick the .json file you saved from here or from the old Set List Generator.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader title="Restore from a file" description="Bring back a saved backup. Backups from the old Set List Generator work too." />
      <div className="flex flex-1 flex-col gap-5 px-6 py-5">
        {pending ? (
          <div className="flex flex-col gap-4 rounded-xl border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] px-4 py-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-neon-hot" strokeWidth={1.75} />
              <div className="min-w-0 text-sm">
                <p className="text-ink">Replace what&rsquo;s in this browser?</p>
                <p className="mt-1 text-[13px] text-muted">
                  Restoring <span className="font-mono text-ink-2 break-all">{pending.name}</span> overwrites your statuses, set lists and rules here. Save a backup first if you&rsquo;re not sure.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-[30px]">
              <Button variant="primary" size="sm" onClick={restore} disabled={busy}>
                <Upload strokeWidth={1.75} />
                {busy ? "Restoring…" : "Yes, restore"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPending(null)} disabled={busy}>
                <X strokeWidth={1.75} />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pick(f);
            }}
            className={cx(
              "flex items-center gap-3.5 rounded-xl border border-dashed px-4 py-3 transition-colors",
              over ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]" : "border-line-strong",
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface">
              <HardDrive className="h-4 w-4 text-ink-2" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-ink">Drop a backup file here</span>
              <span className="block text-xs text-muted">A .json file from the Gig Book or the old app</span>
            </span>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-neon-hot">
            {error}
          </p>
        )}
        <div className="mt-auto">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload strokeWidth={1.75} />
            {pending ? "Pick a different file" : "Restore from a file"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pick(f);
          }}
        />
      </div>
    </Card>
  );
}

function DangerCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const ok = typed.trim().toLowerCase() === CONFIRM_PHRASE;

  return (
    <Card className="border-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-surface/50">
      <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="label mb-1.5">Danger zone</p>
          <h2 className="text-[17px] font-medium text-ink">Start fresh</h2>
          <p className="mt-0.5 max-w-xl text-sm text-muted">Clear every status, set list, custom song, rule and practice log from this browser. There&rsquo;s no undo.</p>
        </div>
        {!open && (
          <Button variant="danger" className="shrink-0 self-start sm:self-auto" onClick={() => setOpen(true)}>
            <Trash2 strokeWidth={1.75} />
            Clear this browser
          </Button>
        )}
      </div>
      {open && (
        <form
          className="flex flex-col gap-3 border-t border-line px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            clearAll();
            setOpen(false);
            setTyped("");
            toast("Cleared. A fresh book is ready");
          }}
        >
          <label htmlFor="confirm-clear" className="text-sm text-ink-2">
            Type <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[13px] text-ink">{CONFIRM_PHRASE}</span> to confirm
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="confirm-clear" autoFocus autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_PHRASE} className="sm:max-w-xs" />
            <div className="flex gap-2">
              <Button type="submit" variant="danger" disabled={!ok}>
                <Trash2 strokeWidth={1.75} />
                Clear everything
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}
    </Card>
  );
}
