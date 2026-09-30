import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Tilt_Neon } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const tilt = Tilt_Neon({ variable: "--font-tilt", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Gig Book",
  description: "Mark what you can play, then build the night's set list.",
};

export const viewport: Viewport = { themeColor: "#060405" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable} ${tilt.variable} dark h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
