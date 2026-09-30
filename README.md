# The Gig Book

A set list builder for gigging musicians: 12 genre books (jazz plus blues, country, rock, pop, R&B, folk, gospel, latin, reggae, hip-hop and wedding), about 4,500 songs. It's a static Next.js app with no backend. Everything is saved in the browser's localStorage.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine + export + practice tests
npm run build    # static site in ./out, host anywhere
```

## Layout

- `src/app/`: routes: `/` genre picker, `/repertoire`, `/build`, `/sets`, `/practice`, `/rules`
- `src/data/genres/*.json`: the song catalog, one file per genre (loaded on demand)
- `src/lib/types.ts`: the shared data model
- `src/lib/engine/`: the set-list builder and its rules (pure TypeScript, tested)
- `src/lib/export/`: text formats and the PDF
- `src/lib/storage.ts`, `src/lib/state.ts`: persistence (keys prefixed `sl:`)
- `src/components/`: UI grouped by screen

## Song credits

`Song` has optional `composer`, `lyricist`, `publishYear` and `firstRecordedBy` fields. The song panel shows them, or "Not researched yet". Add them to the genre JSON files to fill them in.
