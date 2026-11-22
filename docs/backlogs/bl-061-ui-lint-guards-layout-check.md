---
id: BL-061
title: "UI guards: dense-size, dialog, mono, frame lint and a layout check"
type: backlog
status: done
summary: Five new lint rules and a Playwright layout spec with screenshot baselines for every route in light and dark.
tags: [ui, web, lint, testing, dx]
related: [DES-027, DES-030]
updated: 2026-11-22
priority: P0
depends: [BL-057, BL-058, BL-059]
---

# UI guards: dense-size, dialog, mono, frame lint and a layout check

Design: [DES-030](../designs/des-030-ui-renovation-journeys-dx.md) (Lint
guards, Layout check).

## Done when

- [x] Lint errors on: dense sizes outside dense ancestors;
      `DialogContent` widths other than `sm:max-w-md` or `sm:max-w-xl`,
      and any width on `SheetContent` or `AlertDialogContent`;
      `font-mono` outside the allowlist; frame padding outside
      `components/page/`; `toISOString`, `toLocaleString` and
      `toLocaleDateString` under `pages/`.
- [x] Each rule has a unit test with one passing and one failing sample.
- [x] `apps/e2e/tests/layout.spec.ts` checks every route in light and
      dark at 1440x900: header 48px, h1 at x280 with a 20px font,
      content top padding 24px, section edges at x280 unless
      `data-bleed`, controls outside dense containers 32px, body rows
      37px and header rows 41px.
- [x] Baselines are committed and compared with
      `toHaveScreenshot(..., { maxDiffPixelRatio: 0.01 })`.
- [x] DES-008 "Testing and evidence" links to the layout check.

## Notes

- Rules are in `apps/web/eslint-ui-guards.js`; `font-mono` outside the
  allowlist now goes through `mono` in `components/data/mono.ts`.
- Connections and workflow Runs table rows still wrap, so the layout check
  skips their row heights until BL-071 and BL-070 land (`rowsPending` in
  the spec).
- Baselines of routes that list runs, items or connections cover the title
  block only, since other specs change the lists; geometry is asserted on
  the whole page.
