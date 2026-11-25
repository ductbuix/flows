# `@workspace/ui` — theme (`src/styles/globals.css`)

Companion to [ui.md](ui.md) (package, config, tree) and
[ui-components.md](ui-components.md) (every component). Rules for using
these tokens live in [../design-system.md](../design-system.md).

Exported as `@workspace/ui/globals.css`; `apps/web/src/main.tsx` imports it
once. Tailwind 4 with the Vite plugin (`@tailwindcss/vite`), no
`tailwind.config` file (`components.json` has `"config": ""`).

## Imports and source scanning (file order)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/google-sans";

@custom-variant dark (&:is(.dark *));
@source "../../../apps/**/*.{ts,tsx}";
@source "../../../components/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";
```

- `dark:` matches any element **inside** an element with class `dark`
  (next-themes puts `dark` / `light` on `<html>`). It does not match the
  `.dark` element itself.
- `@source` globs are relative to `packages/ui/src/styles/`: every app's
  sources, a (non-existent today) root `components/` folder, and all of
  `packages/ui/src`.
- `tw-animate-css` supplies `animate-in`, `animate-out`, `fade-in-0`,
  `zoom-in-95`, `slide-in-from-*`, etc. used by popups.
- `@fontsource-variable/google-sans` registers the `"Google Sans Variable"`
  font face (all weights, variable).

### What `shadcn/tailwind.css` (shadcn 4.23.0) provides

Used by components; a rebuild must import the same file (or replicate it):

| Kind            | Names                                                                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyframes       | `accordion-down` / `accordion-up` (height 0 ↔ `var(--radix-accordion-content-height, var(--accordion-panel-height, auto))`), `tw-shimmer`, `scroll-fade-reveal-*`                                                                                                                                    |
| Custom variants | `data-open` (`[data-state=open]` or `[data-open]` not `"false"`), `data-closed`, `data-checked`, `data-unchecked`, `data-selected` (`[data-selected=true]`), `data-disabled`, `data-active` (`[data-state=active]` or `[data-active]`), `data-horizontal` / `data-vertical` (`[data-orientation=…]`) |
| Utilities       | `no-scrollbar`; `scroll-fade`, `scroll-fade-x/y/t/b/l/r/s/e`, `scroll-fade-*` sizes, `scroll-fade-none` (mask fades at scroll edges); `shimmer`, `shimmer-once`, `shimmer-reverse`, `shimmer-none`, `shimmer-color-*`, `shimmer-duration-*`, `shimmer-spread-*`, `shimmer-angle-*`                   |

`shimmer` paints text with a moving highlight gradient
(`background-clip: text`, 2 s linear infinite, highlight = currentColor at
20 % alpha in light, lightened to L≥0.8 in dark; disabled under
`prefers-reduced-motion`). Used for live Trace lines and uploading
attachments.

Class names referenced by components but defined nowhere (no-ops today):
`scrollbar-thin`, `scrollbar-none` (code-block, attachment), `cn-toast`
(sonner toast class).

## Color tokens (`:root` = light, `.dark` = dark)

All values are OKLCH. `--header-height` is light-only (`:root`).

| Token                          | Light                       | Dark                         |
| ------------------------------ | --------------------------- | ---------------------------- |
| `--header-height`              | `calc(var(--spacing) * 12)` | (inherits)                   |
| `--background`                 | `oklch(1 0 0)`              | `oklch(0.145 0 0)`           |
| `--foreground`                 | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`           |
| `--card`                       | `oklch(1 0 0)`              | `oklch(0.205 0 0)`           |
| `--card-foreground`            | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`           |
| `--popover`                    | `oklch(1 0 0)`              | `oklch(0.205 0 0)`           |
| `--popover-foreground`         | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`           |
| `--primary`                    | `oklch(0.205 0 0)`          | `oklch(0.922 0 0)`           |
| `--primary-foreground`         | `oklch(0.985 0 0)`          | `oklch(0.205 0 0)`           |
| `--secondary`                  | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`           |
| `--secondary-foreground`       | `oklch(0.205 0 0)`          | `oklch(0.985 0 0)`           |
| `--muted`                      | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`           |
| `--muted-foreground`           | `oklch(0.556 0 0)`          | `oklch(0.708 0 0)`           |
| `--accent`                     | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`           |
| `--accent-foreground`          | `oklch(0.205 0 0)`          | `oklch(0.985 0 0)`           |
| `--destructive`                | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)`  |
| `--success`                    | `oklch(0.56 0.15 150)`      | `oklch(0.74 0.17 152)`       |
| `--info`                       | `oklch(0.52 0.2 272)`       | `oklch(0.72 0.14 272)`       |
| `--warning`                    | `oklch(0.68 0.16 65)`       | `oklch(0.82 0.15 78)`        |
| `--border`                     | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 10%)`         |
| `--input`                      | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 15%)`         |
| `--ring`                       | `oklch(0.708 0 0)`          | `oklch(0.556 0 0)`           |
| `--chart-1`                    | `oklch(0.87 0 0)`           | `oklch(0.87 0 0)`            |
| `--chart-2`                    | `oklch(0.556 0 0)`          | `oklch(0.556 0 0)`           |
| `--chart-3`                    | `oklch(0.439 0 0)`          | `oklch(0.439 0 0)`           |
| `--chart-4`                    | `oklch(0.371 0 0)`          | `oklch(0.371 0 0)`           |
| `--chart-5`                    | `oklch(0.269 0 0)`          | `oklch(0.269 0 0)`           |
| `--radius`                     | `0.75rem`                   | (inherits)                   |
| `--sidebar`                    | `oklch(0.985 0 0)`          | `oklch(0.205 0 0)`           |
| `--sidebar-foreground`         | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`           |
| `--sidebar-primary`            | `oklch(0.205 0 0)`          | `oklch(0.488 0.243 264.376)` |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)`          | `oklch(0.985 0 0)`           |
| `--sidebar-accent`             | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`           |
| `--sidebar-accent-foreground`  | `oklch(0.205 0 0)`          | `oklch(0.985 0 0)`           |
| `--sidebar-border`             | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 10%)`         |
| `--sidebar-ring`               | `oklch(0.708 0 0)`          | `oklch(0.556 0 0)`           |

This is the stock shadcn **neutral** palette with three additions:
`--success`, `--info`, `--warning` (no `-foreground` pair for any of them,
and none for `--destructive` either). Charts are the neutral grey ramp.

## `@theme inline` mapping

Every color token is exposed as a Tailwind color with the `--color-` prefix:
`background, foreground, card, card-foreground, popover,
popover-foreground, primary, primary-foreground, secondary,
secondary-foreground, muted, muted-foreground, accent, accent-foreground,
destructive, success, info, warning, border, input, ring, chart-1…chart-5,
sidebar, sidebar-foreground, sidebar-primary, sidebar-primary-foreground,
sidebar-accent, sidebar-accent-foreground, sidebar-border, sidebar-ring`
(each `--color-X: var(--X)`). So `bg-info/10`, `text-success`,
`ring-foreground/10`, `bg-sidebar` etc. all work.

Radius scale (with `--radius: 0.75rem` = 12 px):

| Theme var      | Formula                     | px   |
| -------------- | --------------------------- | ---- |
| `--radius-sm`  | `calc(var(--radius) * 0.6)` | 7.2  |
| `--radius-md`  | `calc(var(--radius) * 0.8)` | 9.6  |
| `--radius-lg`  | `var(--radius)`             | 12   |
| `--radius-xl`  | `calc(var(--radius) * 1.4)` | 16.8 |
| `--radius-2xl` | `calc(var(--radius) * 1.8)` | 21.6 |
| `--radius-3xl` | `calc(var(--radius) * 2.2)` | 26.4 |
| `--radius-4xl` | `calc(var(--radius) * 2.6)` | 31.2 |

Fonts:

```css
--font-sans: "Google Sans Variable", sans-serif;
--font-heading: "Google Sans Variable", sans-serif;
```

`font-sans` is Tailwind's default body family, so body and headings are
both Google Sans; `font-heading` is used on titles (CardTitle,
DialogTitle, SheetTitle, AlertDialogTitle, EmptyTitle). `font-mono` stays
Tailwind's default monospace stack.

## Custom utility

```css
/* Canvas backdrop (DESIGN.md: canvas). */
@utility bg-dot-grid {
  background-image: radial-gradient(var(--border) 1px, transparent 1px);
  background-size: 16px 16px;
}
```

## Base layer

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

## Theme switching (consumer contract)

The package ships no ThemeProvider. `Toaster` reads `useTheme()` from
`next-themes`, but the web app uses its own provider
(`apps/web/src/components/theme-provider.tsx`, storage key `theme`), not
next-themes; without a next-themes provider `useTheme().theme` is
undefined, so the Toaster falls back to `"system"`. The web provider puts
`light` or `dark` on `<html class>` (e2e writes
`localStorage.theme = "light" | "dark"` and asserts that class). Pressing `d` toggles light/dark (web app).
Root font scaling for "text size" is done by the web app on
`document.documentElement.style.fontSize` (`100%` default, `112.5%`
large); all sizes here are rem-based so they scale.
