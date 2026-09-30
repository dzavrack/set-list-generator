# Gig Book design system

**Direction:** jazz noir with one red neon. Think night-black streets, a single red sign bleeding into smoke, tungsten lamps far down the block, and rain. Structurally it's a clean, modern web app with a sidebar, an inset content panel, big titles, underline tabs and bordered cards. The noir comes from the backdrop, the type and the light. It never comes from ornament.

The finished reference screen is `src/components/repertoire/RepertoireView.tsx`. Match its density, spacing and tone.

## Rules
- **One accent: neon red** (`neon`, `neon-hot`). Use it for the primary action, the active or selected state, and focus. Nothing else gets a hue.
  - No amber, blue, green or gold in the UI.
  - Tungsten amber exists only in the backdrop bokeh.
- **Statuses stay in one hue family.** Use `statusDot` / `statusText` from `@/components/ui/Status`:
  - know: neon red, glowing
  - shaky: dusty rose
  - learn: cream
  - skip: grey
- **Neon is light, not colour.** Use `.neon` (text), `.tube-h` / `.tube-v` (lit lines for active indicators and progress), `.glow-ring`, and `drop-shadow` on icons. Only one or two lit things per screen.
- **Surfaces**, from back to front:
  - `bg`: the street
  - `panel`: the inset content panel
  - `surface`: cards, `rounded-2xl border border-line`
  - `surface-2`: inputs and hover
  - `surface-3`: active
  - Borders are `border-line` or `border-line-strong`. Never use bright borders except the red selected state `border-[rgb(255_43_69/0.55)]`.
- **Type** (fonts set up in `layout.tsx`):
  - `font-serif` (Instrument Serif): page titles (via `PageHeader`), song titles (21px in lists, 36–44px in heroes), set-list names, big moments. Never uppercase it or letter-space it.
  - `font-sans` (Geist): all UI text. Body 14–15px, secondary text `text-ink-2`, tertiary `text-muted`.
  - `font-mono` (Geist Mono): numbers, keys, durations, and `.label` (the small uppercase section label).
  - `font-neon` (Tilt Neon): the brand sign only.
  - No `font-display` uppercase marquee headings anywhere. That look is retired.
- **Icons:** `lucide-react` only, `strokeWidth={1.75}`, sized by the Button's `[&_svg]` rules or `h-4 w-4` / `h-[18px] w-[18px]`. Put an icon on most buttons and every empty state.
- **Radii:** cards 16px (`rounded-2xl`), controls 10px (`rounded-[10px]`), chips `rounded-full`, small tags `rounded-md`.
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
