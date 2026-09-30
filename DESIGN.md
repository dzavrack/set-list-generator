# Gig Book design system

**Direction:** a 1950s-60s jazz record jacket. Anton caps over Libre Franklin, Courier Prime for catalog numbers and labels, flat blocks of the book's colour, square corners, hard offset shadows and printed card stock. No glow anywhere. The mood comes from the type, the colour blocks and the record details. It never comes from ornament.

- **Sidebar:** a **spine** in the book's colour with the title running up it, plus a **tracklist** (Side A: Repertoire, Build a set, Set lists; Side B: Practice, Set builder rules, Backup).
- **Page headers:** every page header is the **cover**: a colour block with the book's name, "High Fidelity", and a record peeking out of the corner. Kept short so the work starts on the first screen.
- **Home page:** leads with the book cards. Each has a thick bar in its colour and the book name in the genre's own typeface.

The palette comes from the Set List Generator reference. The home page and the Jazz book use the base room (orange on warm near-black). Every other book gets its own room: its own accent, background tint and ink.

The finished reference screen is `src/components/repertoire/RepertoireView.tsx`. Match its density, spacing and tone.

The earlier Marquee (neon signs) and Noir (serif, WebGL smoke) looks are kept in the git tag `three-looks`.

## Theming
All colours and type live in `src/app/globals.css`.

- **The room (`data-genre` on `<html>`):** colours plus the sign typeface. A room is eight colours (`--paper`, `--card`, `--card2`, `--rule`, `--ink`, `--muted`, `--accent`, `--signink`) and one font (`--sign-face`). Everything else (`--bg`, `--surface-*`, `--line*`, `--neon*`, `--ink-2`, `--faint`) is derived.
  - Put `data-genre` on any element to dress it in that book's room. The home page's book cards do this.
- **Keeping it in sync:** `GenreTheme` keeps `data-genre` in sync and sets `--book-label`, the book name printed on each page's cover. An inline script in `layout.tsx` applies both before first paint.
- **Book names:** `sign` is the book's plain title ("Blues Book"). The home page cards show it as the big title, in the genre's own typeface.
- **Tokens and hooks:** fonts and radii are tokens. `font-sans`, `font-serif` and `font-mono` point at `--font-body`, `--font-title` and `--font-code`, and every radius is 0. Anything beyond tokens is a small hook class on the component, styled in the record-jacket block of `globals.css`:
  - `btn-primary`, `btn-secondary`, `btn-danger`, `btn-lg`
  - `page-header`, `card-title`, `app-panel`
  - `tabs-bar`, `tab`, `tab-tube`
  - `stat`, `stat-label`, `stat-value`, `stat-sub` (+ `data-tone`)
  - `status-btn` (+ `data-status`), `status-lg`, `qs-title`
  - `title-plain` (song names and free text that must stay mixed case)
  - `song-row`, `pace-chip`, `plan-card`, `week-bar`, `rule-num`
  - `mobile-top`, `mobile-tabs`, `mobile-tab`, `quick-action`
  - `home-bar`, `book-grid`, `book-card`, `book-count`, `book-foot`, `book-open`
  - `sleeve-rail`, `sleeve-spine`, `sleeve-track` (the sidebar), `sign-dim` (a book name in its own typeface)
- **Tones:** `data-tone="know|shaky|learn|no|accent"` on an element sets `--tone` (see `Tone` in `components/ui/tone.ts`). It colours stat numbers and their top bars, song-row edges, sidebar and tab-bar icons, pace chips and plan cards. `StatusBar` is the multi-coloured sorted bar.

Never hard-code a colour in a component. For a tint, use `color-mix(in_srgb,var(--accent)_15%,transparent)` (or `var(--ink)` for neutral tints).

## Rules
- **One accent per room** (`neon`, `neon-hot`, which follow `--accent`). Use it for the primary action, the active or selected state, and the page cover. Beyond that, only the statuses get a hue.
  - Text on an accent fill uses the print ink (`--sleeve-ink`, or `text-neon-ink`), so light accents like lime and gold stay readable.
- **Statuses** use `statusDot` / `statusText` from `@/components/ui/Status`:
  - know: green (`--know`)
  - shaky: gold (`--shaky`)
  - learn: blue (`--learn`)
  - skip: red (`--skip`)
- **Flat, printed colour:**
  - `.tube-h` / `.tube-v` are plain accent lines (progress, active markers).
  - `.glow-ring` is a 2px accent ring.
  - Depth comes from hard offset shadows (`4px 4px 0`), not blur.
- **Surfaces**, from back to front:
  - `bg`: the card stock
  - `panel` / `surface`: cards
  - `surface-2`: inputs and hover
  - `surface-3`: active
  - Borders are `border-line` or `border-line-strong`.
- **Type** (fonts set up in `layout.tsx`):
  - `font-serif` (Anton): page titles (via `PageHeader`), big moments, set-list names. Always caps.
  - `title-plain`: song titles in lists stay Franklin, mixed case.
  - `font-sans` (Libre Franklin): all UI text. Body 14–15px, secondary text `text-ink-2`, tertiary `text-muted`.
  - `font-mono` (Courier Prime): numbers, keys, durations, catalog numbers, and `.label` (the small uppercase section label).
  - Sign faces (Tilt Neon, Rye, Bungee, Monoton…): the book names on the home page only.
- **Icons:** `lucide-react` only, `strokeWidth={1.75}`, sized by the Button's `[&_svg]` rules or `h-4 w-4` / `h-[18px] w-[18px]`. Put an icon on most buttons and every empty state.
- **Radii:** everything is square. Components still use the named radii (`rounded-2xl`, `rounded-control`, `rounded-chip`…), which are all 0. Keep `rounded-full` for dots and switches only.
- **Motion:** 150ms colour transitions and the small press offset on primary buttons. Respect reduced motion.
- **Layout:** pages render beside the spine rail, in a column that is `max-w-[1280px]`.
  - Start every page with `PageHeader` (title, a one-line description, actions on the right).
  - Then optional `Tabs`, then a row of `StatCard`s where numbers matter, then content in `Card`s.
  - Vertical rhythm is `gap-6` between sections.
- **Phones:** everything works at 375px.
  - No horizontal page scroll.
  - Tap targets are at least 40px.
  - Filter chips scroll sideways, and sheets go full screen.
  - Stat rows collapse to one compact strip, and the cover drops its description.

## Primitives (`src/components/ui/`)
- `Button`: variants `primary` (one per view), `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `lg`, `icon`.
- `Field`, `Input`, `Textarea`, `Select` (with a chevrons icon) and `Toggle` (`Field.tsx`).
- `PageHeader`, `Card`, `CardHeader`, `StatCard` and `Tabs` (`Page.tsx`).
- `Segmented`, `Sheet` + `SheetHeader`, `Empty` (takes an `icon`), `toast()`, `StatusPicker`, `StatusBar`, `StyleTag` and `cx` (`tailwind-merge`).

## Copy
Plain, warm and musician-to-musician: "Build a set", "ready for the stand", "Nothing on the stand yet". No jargon and no exclamation marks.
