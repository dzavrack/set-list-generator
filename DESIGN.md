# Gig Book design system

**Direction:** an after-hours room lit by one neon sign. Think a dark street, a single sign bleeding into smoke, tungsten lamps far down the block, and rain. Structurally it's a clean, modern web app with a sidebar, an inset content panel, big titles, underline tabs and bordered cards. The mood comes from the backdrop, the type and the light. It never comes from ornament.

The palette comes from the Set List Generator reference. The home page and the Jazz book use the base look (orange neon on warm near-black). Every other book gets its own room: its own accent, background tint and ink.

The finished reference screen is `src/components/repertoire/RepertoireView.tsx`. Match its density, spacing and tone.

## Theming
Two independent switches, both attributes on `<html>`, both defined in `src/app/globals.css`:

- **`data-genre` (the room):** colours plus the sign typeface. A room is eight colours (`--paper`, `--card`, `--card2`, `--rule`, `--ink`, `--muted`, `--accent`, `--signink`) and one font (`--sign-face`). Everything else (`--bg`, `--surface-*`, `--line*`, `--neon*`, `--ink-2`, `--faint`) is derived. Put `data-genre` on any element to dress it in that book's room (the home page's book cards do this).
- **`data-look` (the look):** type, shapes, backdrop and (for Sleeve) the shell layout. Stored as `sl:look`, switched from the sidebar (or More on phones).
  - **Sleeve** (default): a 1950s-60s jazz record jacket. Anton caps over Libre Franklin, Courier Prime catalog numbers, flat blocks of the book's colour, square corners, hard offset shadows, printed card stock, no glow. The sidebar is a **spine** (the book's colour, title running up it) plus a **tracklist** (Side A: Repertoire, Build, Set lists; Side B: Practice, Set builder rules, Backup). Every page header is the **cover**: a colour block with the book's name, "High Fidelity", and a record peeking out of the corner. The home page keeps the genre cards: each with a thick bar in its colour and its book name in the genre's own typeface, printed flat.
  - **Marquee**: after the Set List Generator reference. Oswald caps for titles, Barlow for body, Courier Prime for labels and numbers, square corners, outlined buttons that glow, boxed tabs, a striped wall, and the open book's own neon sign ("Juke Joint", "Honky Tonk"...) in the sidebar.
  - **Noir:** Instrument Serif titles, Geist, rounded cards, the WebGL smoke backdrop.

`GenreTheme` keeps both attributes in sync (and sets `--book-label`, the Sleeve cover's book name), and an inline script in `layout.tsx` applies them before first paint.

**Layout per look.** Where a look changes structure rather than style, both versions are rendered and CSS shows one: `look-noir` / `look-marquee` / `look-sleeve` show only in that look, `not-noir` / `not-sleeve` hide in it. This avoids a flash of the wrong layout before React reads the saved look. `SleeveRail` and `Sidebar` in `AppShell.tsx` are the example.

**Book names.** `sign` is the book's plain title ("Blues Book"), used inside the app. The home page cards show it as the big title, in the genre's own typeface.

**How a look is built.** Fonts and radii are tokens: `font-sans`, `font-serif` and `font-mono` point at `--font-body`, `--font-title` and `--font-code`. `rounded-control`, `rounded-panel`, `rounded-chip` and Tailwind's `rounded-*` all read radius variables the look overrides. Anything beyond tokens is a small hook class on the component that only the look's CSS block styles:
- `btn-primary`, `btn-secondary`, `btn-danger`, `btn-lg`
- `page-header`, `card-title`
- `tabs-bar`, `tab`, `tab-tube`
- `stat`, `stat-label`, `stat-value`, `stat-sub` (+ `data-tone`)
- `status-btn` (+ `data-status`), `nav-link`, `app-panel`, `book-card`
- `title-plain` (song names and free text that must stay mixed case), `hero-title`, `hero-accent`
- `song-row`, `pace-chip`, `plan-card`, `week-bar`, `rule-num`, `status-lg`, `qs-title`, `mobile-tab`, `mobile-top`, `mobile-tabs`, `quick-action`, `hero`, `book-grid`, `spectrum`, `spectrum-rule`, `home-eyebrow`

**Tones.** `data-tone="know|shaky|learn|no|accent"` on an element sets `--tone` (see `Tone` in `components/ui/tone.ts`). Marquee uses it for colour the way the reference does: stat numbers and their top edges, song-row edges, sidebar icons, pace chips and plan cards. `StatusBar` is the reference's multi-coloured sorted bar. Noir ignores tones except on `StyleTag tone`.
- `look-noir` / `look-marquee` (show only in that look), `sign` / `sign-dim` (the book's lit sign)

**Adding another look** means one `[data-look="name"] { ... }` token block, a block of hook styles, an entry in `LOOKS` (`src/lib/state.ts`), and a backdrop in `Backdrop.tsx`. No component changes.

Never hard-code a colour in a component. For a tint, use `color-mix(in_srgb,var(--accent)_15%,transparent)` (or `var(--ink)` for neutral tints).

## Rules
- **One accent per room** (`neon`, `neon-hot`, which follow `--accent`). Use it for the primary action, the active or selected state, and focus. Nothing else in the UI gets a hue except the statuses.
  - Text on an accent fill is `text-neon-ink` (dark), so light accents like lime and gold stay readable.
  - Tungsten amber exists only in the backdrop bokeh.
- **Statuses** use `statusDot` / `statusText` from `@/components/ui/Status`:
  - know: green (`--know`), glowing
  - shaky: gold (`--shaky`)
  - learn: blue (`--learn`)
  - skip: red (`--skip`)
- **Neon is light, not colour.** Use `.neon` (text), `.tube-h` / `.tube-v` (lit lines for active indicators and progress), `.glow-ring`, and `drop-shadow` on icons. Only one or two lit things per screen.
- **Surfaces**, from back to front:
  - `bg`: the street
  - `panel`: the inset content panel
  - `surface`: cards, `rounded-2xl border border-line`
  - `surface-2`: inputs and hover
  - `surface-3`: active
  - Borders are `border-line` or `border-line-strong`. Never use bright borders except the selected state `border-[color-mix(in_srgb,var(--accent)_55%,transparent)]`.
- **Type** (fonts set up in `layout.tsx`; the faces named here are Noir's, and Marquee swaps them as above):
  - `font-serif` (Instrument Serif): page titles (via `PageHeader`), song titles (21px in lists, 36–44px in heroes), set-list names, big moments. Never uppercase it or letter-space it.
  - `font-sans` (Geist): all UI text. Body 14–15px, secondary text `text-ink-2`, tertiary `text-muted`.
  - `font-mono` (Geist Mono): numbers, keys, durations, and `.label` (the small uppercase section label).
  - `font-neon` (Tilt Neon): the brand sign only.
  - No `font-display` uppercase marquee headings anywhere. That look is retired.
- **Icons:** `lucide-react` only, `strokeWidth={1.75}`, sized by the Button's `[&_svg]` rules or `h-4 w-4` / `h-[18px] w-[18px]`. Put an icon on most buttons and every empty state.
- **Radii:** cards `rounded-2xl`, controls `rounded-control`, segmented items `rounded-control-sm`, chips `rounded-chip`, small tags `rounded-md`. Keep `rounded-full` for dots and switches only. Never use a pixel radius; the look sets these.
- **Motion:** 150ms colour transitions only, plus the existing neon flicker and smoke drift. Respect reduced motion.
- **Layout:** pages render inside `AppShell`'s panel, which is `max-w-[1280px]`.
  - Start every page with `PageHeader` (title, a one-line description, actions on the right).
  - Then optional `Tabs`, then a row of `StatCard`s where numbers matter, then content in `Card`s.
  - Vertical rhythm is `gap-8` between sections.
- **Phones:** everything works at 375px. No horizontal page scroll. Tap targets are at least 40px. Filter chips scroll sideways. Sheets go full screen.

## Primitives (`src/components/ui/`)
- `Button`: variants `primary` (one per view), `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `lg`, `icon`.
- `Field`, `Input`, `Textarea`, `Select` (with a chevrons icon) and `Toggle` (`Field.tsx`).
- `PageHeader`, `Card`, `CardHeader`, `StatCard` and `Tabs` (`Page.tsx`).
- `Segmented`, `Sheet` + `SheetHeader`, `Empty` (takes an `icon`), `toast()`, `StatusPicker`, `StyleTag` and `cx` (`tailwind-merge`).

## Copy
Plain, warm and musician-to-musician: "Build a set", "ready for the stand", "Nothing on the stand yet". No jargon and no exclamation marks.
