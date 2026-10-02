// Renders every theme/layout combo in node to prove the document builds.
// Set PDF_OUT=/some/dir to also write the PDFs for a visual check.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURE_SET_LIST, FIXTURE_SONGS } from "./fixture";
import { createSetListDocument, type PdfLayout, type PdfTheme } from "./pdf";

const fontsUrl = join(__dirname, "../../../public/fonts") + "/";
const R = await import("@react-pdf/renderer");

describe("set list PDF", () => {
  for (const theme of ["noir", "print"] as PdfTheme[]) {
    for (const layout of ["plain", "one-page", "set-per-page", "stage", "compact"] as PdfLayout[]) {
      it(`renders ${theme} / ${layout}`, async () => {
        const doc = createSetListDocument(R, FIXTURE_SET_LIST, {
          theme, layout, showKeys: true, showFeels: true, showTimes: true, showBackups: true, showCredits: true,
          songs: FIXTURE_SONGS, fontsUrl,
        });
        const buf = await R.renderToBuffer(doc);
        expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
        if (process.env.PDF_OUT) writeFileSync(join(process.env.PDF_OUT, `${theme}-${layout}.pdf`), buf);
      }, 30_000);
    }
  }

  const grow = (sets: number, perSet: number) => ({
    ...FIXTURE_SET_LIST,
    name: "Saturday Wedding Reception at the Grand Ballroom",
    sets: Array.from({ length: sets }, (_, i) => ({
      name: `Set ${i + 1}`,
      items: Array.from({ length: perSet }, (_, j) => ({ ...FIXTURE_SET_LIST.sets[j % 2].items[j % 6], songId: `s${i}-${j}` })),
    })),
  });
  const cases: [string, ReturnType<typeof grow>][] = [
    ["three-sets", grow(3, 14)],
    ["four-sets", grow(4, 10)],
    ["overflow", grow(3, 34)],
    ["empty", { ...FIXTURE_SET_LIST, name: "", venue: undefined, date: undefined, sets: [], backups: [] }],
  ];
  for (const [name, sl] of cases) {
    it(`renders ${name}`, async () => {
      for (const layout of ["plain", "one-page", "set-per-page", "stage", "compact"] as PdfLayout[]) {
        const buf = await R.renderToBuffer(createSetListDocument(R, sl, { theme: "noir", layout, fontsUrl }));
        expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
        if (process.env.PDF_OUT) writeFileSync(join(process.env.PDF_OUT, `${name}-${layout}.pdf`), buf);
      }
    }, 30_000);
  }
});
