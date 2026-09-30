"use client";
// Background info for catalog tunes ("About this tune"). One lazily loaded file per genre;
// genres without research yet simply have none.
import { useEffect, useState } from "react";
import type { GenreKey, SongInfo } from "./types";

type InfoBook = Record<string, SongInfo>;
const cache = new Map<GenreKey, InfoBook>();

function importInfo(genre: GenreKey): Promise<InfoBook> {
  switch (genre) {
    case "jazz": return import("@/data/info/jazz.json").then((m) => m.default as InfoBook);
    default: return Promise.resolve({});
  }
}

export function useSongInfo(genre: GenreKey, songId: string | undefined): SongInfo | undefined {
  // The cache is the source of truth; this only re-renders once a genre's file arrives.
  const [, loaded] = useState(0);
  useEffect(() => {
    if (cache.has(genre)) return;
    let live = true;
    importInfo(genre).then((b) => {
      cache.set(genre, b);
      if (live) loaded((n) => n + 1);
    });
    return () => { live = false; };
  }, [genre]);
  return songId ? cache.get(genre)?.[songId] : undefined;
}

/** Search links always resolve (unlike a specific video that can be taken down). */
export function listenLinks(title: string, r?: { artist: string; year?: number }) {
  const q = [title, r?.artist, r?.year].filter(Boolean).join(" ");
  return {
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    spotify: `https://open.spotify.com/search/${encodeURIComponent([title, r?.artist].filter(Boolean).join(" "))}`,
  };
}
