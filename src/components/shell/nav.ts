import type { Tone } from "@/components/ui/tone";
import { BookOpenText, Clock3, DatabaseBackup, Ellipsis, ListMusic, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Icon colour in the Marquee look */
  tone?: Tone;
}

export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/repertoire/", label: "Repertoire", icon: BookOpenText, tone: "know" },
      { href: "/build/", label: "Build a set", icon: Sparkles, tone: "accent" },
      { href: "/sets/", label: "Set lists", icon: ListMusic, tone: "shaky" },
    ],
  },
  { title: "Woodshed", items: [{ href: "/practice/", label: "Practice", icon: Clock3, tone: "learn" }] },
  {
    title: "Book",
    items: [
      { href: "/rules/", label: "Set builder rules", icon: SlidersHorizontal },
      { href: "/backup/", label: "Backup", icon: DatabaseBackup },
    ],
  },
];

export const MOBILE_NAV: NavItem[] = [
  { href: "/repertoire/", label: "Repertoire", icon: BookOpenText, tone: "know" },
  { href: "/build/", label: "Build", icon: Sparkles, tone: "accent" },
  { href: "/sets/", label: "Sets", icon: ListMusic, tone: "shaky" },
  { href: "/practice/", label: "Practice", icon: Clock3, tone: "learn" },
];

/** Phone "More" menu */
export const MOBILE_MORE: NavItem[] = [
  { href: "/rules/", label: "Set builder rules", icon: SlidersHorizontal },
  { href: "/backup/", label: "Backup", icon: DatabaseBackup },
];
export const MoreIcon = Ellipsis;

export const isActive = (path: string | null, href: string) => !!path && (path === href || path.startsWith(href.replace(/\/$/, "") + "/") || path === href.replace(/\/$/, ""));
