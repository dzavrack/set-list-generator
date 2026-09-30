"use client";
import { Check, ExternalLink, Play } from "lucide-react";
import type { GenreConfig, Recording, Song, SongInfo } from "@/lib/types";
import { listenLinks, useSongInfo } from "@/lib/info";
import { cx } from "@/components/ui/cx";

/** "About this tune": credits, where it came from, first and landmark recordings, listening links. */
export function AboutTune({ song, genre }: { song: Song; genre: GenreConfig }) {
  const info = useSongInfo(genre.key, song.custom ? undefined : song.id);
  if (song.custom) return null;

  const credits = info ? creditRows(info) : [];
  const hasRecordings = !!(info?.firstRecording || info?.famous?.length);

  return (
    <section className="space-y-4" aria-labelledby="about-h">
      <h3 id="about-h" className="card-title text-[13px] text-ink-2">About this {genre.noun}</h3>

      {!info || (!credits.length && !hasRecordings) ? (
        <p className="text-sm text-muted">Not researched yet.</p>
      ) : (
        <>
          {credits.length > 0 && (
            <dl className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-2 text-[14px]">
              {credits.map(([label, value, unverified]) => (
                <div key={label} className="contents">
                  <dt className="label pt-0.5">{label}</dt>
                  <dd className="text-ink">
                    {value}
                    {unverified && <Unverified />}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {info.firstRecording && (
            <div className="space-y-1.5">
              <p className="label">First recorded</p>
              <RecordingRow title={song.title} r={info.firstRecording} unverified={info.unverified?.includes("firstRecording")} />
            </div>
          )}

          {!!info.famous?.length && (
            <div className="space-y-1.5">
              <p className="label">Landmark recordings</p>
              <ul className="divide-y divide-line rounded-control border border-line">
                {info.famous.map((r, i) => (
                  <li key={`${r.artist}-${i}`}>
                    <RecordingRow title={song.title} r={r} unverified={!r.confirmed} boxed />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs text-muted">
            {info.links?.wikipedia && <SourceLink href={info.links.wikipedia}>Wikipedia</SourceLink>}
            {info.links?.wikidata && <SourceLink href={info.links.wikidata}>Wikidata</SourceLink>}
            <SourceLink href={listenLinks(song.title).youtube}>More on YouTube</SourceLink>
          </div>
          {(info.unverified?.length || info.famous?.some((r) => !r.confirmed)) && (
            <p className="text-[12px] leading-snug text-faint">
              † Unverified: from general jazz history, not a cited source. Worth a double-check before you quote it on the mic.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function creditRows(info: SongInfo): [string, React.ReactNode, boolean][] {
  const u = (f: NonNullable<SongInfo["unverified"]>[number]) => !!info.unverified?.includes(f);
  const rows: [string, React.ReactNode, boolean][] = [];
  const sameWriters = info.composer && info.lyricist && info.composer === info.lyricist;
  if (info.composer) rows.push([sameWriters ? "Words & music" : "Music", info.composer, u("composer")]);
  if (info.lyricist && !sameWriters) rows.push(["Lyrics", info.lyricist, u("lyricist")]);
  if (info.year) rows.push(["Written", info.year, u("year")]);
  if (info.origin) rows.push(["From", <>the {info.originKind === "film" ? "film" : "show"} <em className="not-italic text-ink">{info.origin}</em></>, u("origin")]);
  return rows;
}

function RecordingRow({ title, r, unverified, boxed }: { title: string; r: Recording; unverified?: boolean; boxed?: boolean }) {
  const links = listenLinks(title, r);
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1", boxed && "px-3 py-2.5")}>
      <span className="min-w-0 flex-1 text-[14px] text-ink">
        <span className="font-medium">{r.artist}</span>
        {r.year && <span className="tabular ml-1.5 font-mono text-xs text-muted">{r.year}</span>}
        {r.note && <span className="ml-1.5 text-[13px] text-muted">({r.note})</span>}
        {r.confirmed && <Check className="ml-1.5 inline h-3.5 w-3.5 text-know" strokeWidth={2.25} aria-label="Named by Wikipedia" />}
        {unverified && <Unverified />}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <ListenLink href={links.youtube} label={`Search YouTube for ${r.artist}'s ${title}`}><Play className="h-3 w-3 fill-current" strokeWidth={0} />YouTube</ListenLink>
        <ListenLink href={links.spotify} label={`Search Spotify for ${r.artist}'s ${title}`}>Spotify</ListenLink>
      </span>
    </div>
  );
}

function ListenLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-7 items-center gap-1 rounded-control-sm border border-line-strong px-2 text-[11.5px] text-ink-2 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:text-ink"
    >
      {children}
    </a>
  );
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-ink">
      {children}
      <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
    </a>
  );
}

function Unverified() {
  return (
    <sup title="Unverified: from general jazz history, not a cited source" aria-label="unverified" className="ml-0.5 cursor-help font-mono text-[11px] text-faint">
      †
    </sup>
  );
}
