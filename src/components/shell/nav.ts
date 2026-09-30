import { BookOpenText, Clock3, DatabaseBackup, Ellipsis, ListMusic, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/repertoire/", label: "Repertoire", icon: BookOpenText },
      { href: "/build/", label: "Build a set", icon: Sparkles },
      { href: "/sets/", label: "Set lists", icon: ListMusic },
    ],
  },
  { title: "Woodshed", items: [{ href: "/practice/", label: "Practice", icon: Clock3 }] },
  {
    title: "Book",
    items: [
      { href: "/rules/", label: "House rules", icon: SlidersHorizontal },
      { href: "/backup/", label: "Backup", icon: DatabaseBackup },
    ],
  },
];

export const MOBILE_NAV: NavItem[] = [
  { href: "/repertoire/", label: "Repertoire", icon: BookOpenText },
  { href: "/build/", label: "Build", icon: Sparkles },
  { href: "/sets/", label: "Sets", icon: ListMusic },
  { href: "/practice/", label: "Practice", icon: Clock3 },
];

/** Phone "More" menu */
export const MOBILE_MORE: NavItem[] = [
  { href: "/rules/", label: "House rules", icon: SlidersHorizontal },
  { href: "/backup/", label: "Backup", icon: DatabaseBackup },
];
export const MoreIcon = Ellipsis;

export const isActive = (path: string | null, href: string) => !!path && (path === href || path.startsWith(href.replace(/\/$/, "") + "/") || path === href.replace(/\/$/, ""));
