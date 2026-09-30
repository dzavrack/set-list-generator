"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { GENRES } from "@/lib/genres";
import { useGenre, useLook } from "@/lib/state";

/**
 * Puts the look on <html data-look> and the open book on <html data-genre>, which swap in
 * that look's type and shapes and that genre's colours from globals.css. The home page stays
 * on the base (orange) room. The inline script in layout.tsx does the same before first paint
 * so there's no flash of the wrong theme.
 */
export function GenreTheme() {
  const [genre] = useGenre();
  const [look] = useLook();
  const home = usePathname() === "/";
  useEffect(() => {
    const el = document.documentElement;
    if (home) delete el.dataset.genre;
    else el.dataset.genre = genre;
    // the Sleeve look prints the book's title on each page's cover
    el.style.setProperty("--book-label", JSON.stringify((GENRES[genre]?.sign ?? "").toUpperCase()));
  }, [genre, home]);
  useEffect(() => {
    document.documentElement.dataset.look = look;
  }, [look]);
  return null;
}
