import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  Alfa_Slab_One,
  Anton,
  Bungee,
  Cinzel,
  Courier_Prime,
  Great_Vibes,
  Libre_Franklin,
  Monoton,
  Pacifico,
  Permanent_Marker,
  Righteous,
  Rye,
  Tilt_Neon,
} from "next/font/google";
import "./globals.css";
import { GenreTheme } from "@/components/shell/GenreTheme";
import { GENRE_THEME_BOOT } from "@/lib/theme";

// A heavy condensed display face over Franklin Gothic, like the old record jackets, and a typewriter for labels
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const franklin = Libre_Franklin({ variable: "--font-franklin", subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], style: ["normal", "italic"] });
const courier = Courier_Prime({ variable: "--font-courier", subsets: ["latin"], weight: ["400", "700"] });

// Book signs: one per genre (the home page's book names). Not preloaded; the browser fetches only the ones on screen.
const tilt = Tilt_Neon({ variable: "--font-tilt", subsets: ["latin"], preload: false });
// (next/font needs literal options here, so no shared object.)
const rye = Rye({ subsets: ["latin"], weight: "400", preload: false, variable: "--font-rye" });
const bungee = Bungee({ subsets: ["latin"], weight: "400", preload: false, variable: "--font-bungee" });
const monoton = Monoton({ subsets: ["latin"], weight: "400", preload: false, variable: "--font-monoton" });
const righteous = Righteous({ subsets: ["latin"], weight: "400", preload: false, variable: "--font-righteous" });
const alfa = Alfa_Slab_One({ subsets: ["latin"], weight: "400", preload: false, variable: "--font-alfa" });
const cinzel = Cinzel({ subsets: ["latin"], weight: "700", preload: false, variable: "--font-cinzel" });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", preload: false, variable: "--font-pacifico" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", preload: false, variable: "--font-marker" });
const vibes = Great_Vibes({ subsets: ["latin"], weight: "400", preload: false, variable: "--font-vibes" });

const FONTS = [anton, franklin, courier, tilt, rye, bungee, monoton, righteous, alfa, cinzel, pacifico, marker, vibes]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "The Gig Book",
  description: "Mark what you can play, then build the night's set list.",
};

export const viewport: Viewport = { themeColor: "#0a0908" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${FONTS} dark h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <GenreTheme />
        {children}
        <Script id="genre-theme" strategy="beforeInteractive">{GENRE_THEME_BOOT}</Script>
      </body>
    </html>
  );
}
