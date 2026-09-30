"use client";
import { useLook } from "@/lib/state";
import { NoirBackdrop } from "./NoirBackdrop";

/**
 * The wall behind the app: Noir's WebGL street, the Marquee's striped wall (lit in every
 * book's colour on the home page), or the Sleeve's printed card stock.
 */
export function Backdrop({ home }: { home?: boolean }) {
  const [look] = useLook();
  if (look === "noir") return <NoirBackdrop tubes={!home} />;
  if (look === "sleeve") return <div aria-hidden className="sleeve-wall" />;
  return <div aria-hidden className={home ? "marquee-wall wall-home" : "marquee-wall"} />;
}
