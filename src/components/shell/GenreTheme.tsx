"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { GENRES } from "@/lib/genres";
import { useGenre } from "@/lib/state";

/**
 * Puts the open book on <html data-genre>, which swaps in that genre's colours from globals.css.
 * The home page stays on the base (orange) room. The inline script in layout.tsx does the same
 * before first paint so there's no flash of the wrong colours.
 */
export function GenreTheme() {
  const [genre] = useGenre();
  const home = usePathname() === "/";
  useEffect(() => {
    const el = document.documentElement;
    if (home) delete el.dataset.genre;
    else el.dataset.genre = genre;
    // each page's cover prints the book's title
    el.style.setProperty("--book-label", JSON.stringify((GENRES[genre]?.sign ?? "").toUpperCase()));
  }, [genre, home]);
  return null;
}
