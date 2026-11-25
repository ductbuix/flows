# `@workspace/ui` — shadcn parts, AI Element patterns, theme

Path: `packages/ui`. Browser-only React 19 component library consumed by
`apps/web` (and through it `apps/desktop`). No build step: `exports` point
at `.ts` / `.tsx` / `.css` sources and the consumer (Vite) compiles them.
Domain-free: nothing here may import `@workspace/contracts` or any other
workspace package. Flows-bound adaptations live in
`apps/web/src/components/ai-elements/`.

This spec is split in three:

- this file: package.json, configs, file tree, `lib/utils`, hooks;
- [ui-theme.md](ui-theme.md): `globals.css`, every CSS custom property in
  light and dark, fonts, radius scale, Tailwind 4 setup;
- [ui-components.md](ui-components.md): every component file.

Usage rules (which part for which need, tint recipes, copy) are in
[../design-system.md](../design-system.md).

## package.json

```json
{
  "name": "@workspace/ui",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": { "lint": "eslint", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@base-ui/react": "^1.9.0",
    "@fontsource-variable/google-sans": "^5.3.2",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.5.2",
    "lucide-react": "^1.77.0",
    "next-themes": "^0.4.6",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-resizable-panels": "^4.24.1",
    "shadcn": "^4.23.0",
    "shiki": "^4.6.0",
    "sonner": "^2.0.8",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@eslint/js": "^10",
    "@tailwindcss/vite": "^4",
    "@turbo/gen": "^2.11.13",
    "@types/node": "^26",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^10",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.8",
    "globals": "^17",
    "tailwindcss": "^4",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8"
  },
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./lib/*": "./src/lib/*.ts",
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts"
  }
}
```

Notes:

- There is no root `"."` export: always import a subpath, e.g.
  `@workspace/ui/components/button`, `@workspace/ui/lib/utils`,
  `@workspace/ui/hooks/use-mobile`, `@workspace/ui/globals.css`.
- `shiki` and `zod` are declared but not imported by any file in `src`
  (kept for CLI-added parts). `shadcn` is a runtime dep only because
  `globals.css` imports `shadcn/tailwind.css` from it.
- No `test` script; the package has no tests.
- Installed versions at time of writing: `shadcn@4.23.0`, `cn@0.5.2`.

## components.json (shadcn CLI config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@workspace/ui/components",
    "utils": "@workspace/ui/lib/utils",
    "hooks": "@workspace/ui/hooks",
    "lib": "@workspace/ui/lib",
    "ui": "@workspace/ui/components"
  },
  "rtl": false,
  "menuColor": "default-translucent",
  "menuAccent": "subtle"
}
```

`base-nova` = shadcn's Base UI (`@base-ui/react`) flavour, "nova" style
(compact: `h-8` controls, `rounded-lg`, `ring-1 ring-foreground/10`
surfaces). `menuColor: default-translucent` makes every menu-like popup
(dropdown, select, combobox) `bg-popover/70` with a `backdrop-blur-2xl`
pseudo-layer; `menuAccent: subtle` makes highlighted items
`bg-foreground/10` instead of `bg-accent`. Add parts with
`pnpm dlx shadcn@latest add <name> -c apps/web` (run `--dry-run` first:
the CLI can rewrite `globals.css` and fonts).

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "paths": { "@workspace/ui/*": ["./src/*"] }
  },
  "include": ["."],
  "exclude": ["node_modules", "dist"]
}
```

Does **not** extend the root tsconfig. Internal imports use the
`@workspace/ui/*` self-alias (e.g. `@workspace/ui/components/button`),
resolved by `paths` here and by the same `paths` entry
(`"@workspace/ui/*": ["../../packages/ui/src/*"]`) in `apps/web`'s
tsconfigs. Imports carry no file extension.

`tsconfig.lint.json` is the same compiler options minus `noEmit` and
`paths`, plus `"outDir": "dist"`, `include: ["src", "turbo"]`,
`exclude: ["node_modules", "dist"]` (unused by scripts; kept for tooling).

## eslint.config.js

Flat config via `defineConfig`:

1. `globalIgnores(["dist"])`.
2. `noCycleBlock` from root `eslint-dependency-guards.mjs`
   (`import/no-cycle` error, `maxDepth: Infinity`, via
   `eslint-plugin-import-x` registered as `import`).
3. `**/*.{ts,tsx}`: extends `@eslint/js` recommended,
   `typescript-eslint` recommended, `react-hooks` `flat.recommended`,
   `react-refresh` `vite`; `globals.browser`; rule
   `react-refresh/only-export-components: "off"`.
4. `max-lines` warn 200 (skip blank + comments) for `**/*.{ts,tsx}`
   **except** `src/components/**` (shadcn-generated).
5. `max-lines` warn 300 for `*.test.*` / `*.spec.*`.

## File tree

```
packages/ui/
  components.json            shadcn CLI config (base-nova, neutral, lucide)
  package.json
  tsconfig.json              strict, bundler, @workspace/ui/* self-alias
  tsconfig.lint.json         same options with outDir (tooling only)
  eslint.config.js
  src/
    lib/utils.ts             cn re-export
    lib/.gitkeep
    hooks/use-mobile.ts      useIsMobile (768 px breakpoint)
    hooks/.gitkeep
    styles/globals.css       Tailwind 4 entry, tokens, fonts, bg-dot-grid
    components/.gitkeep
    components/*.tsx         51 component files, see ui-components.md
```

Component files (one-line purpose; details in ui-components.md):

| File            | Kind           | Purpose                                                   |
| --------------- | -------------- | --------------------------------------------------------- |
| `accordion`     | stock          | Base UI Accordion with chevron up/down icons              |
| `alert`         | stock          | Inline alert (default / destructive)                      |
| `alert-dialog`  | stock          | Confirm dialog with sm/default sizes, media slot          |
| `attachment`    | AI Element     | File/attachment chip with state, media, actions           |
| `avatar`        | stock          | Avatar, fallback, badge, group                            |
| `badge`         | stock          | Pill label, 6 variants, `render` prop                     |
| `breadcrumb`    | stock          | Path trail                                                |
| `button`        | stock + `pill` | Button, 6 variants, 9 sizes (adds `pill`)                 |
| `button-group`  | stock          | Joined buttons, text, separator                           |
| `card`          | stock          | Ring-only card with sm size and slots                     |
| `checkbox`      | stock          | Checkbox                                                  |
| `code-block`    | AI Element     | Bordered code surface, copy button, numbered/diff lines   |
| `collapsible`   | stock          | Base UI Collapsible passthrough                           |
| `combobox`      | stock          | Base UI Combobox: input, list, chips                      |
| `command`       | custom         | cmdk-free searchable list in shadcn `command` shape       |
| `confirmation`  | AI Element     | Approve / Deny row on an outline Item                     |
| `dialog`        | stock          | Modal dialog                                              |
| `dropdown-menu` | stock          | Base UI Menu (translucent)                                |
| `empty`         | stock − dashed | Empty state (no dashed border)                            |
| `field`         | stock          | Field, label, set, legend, error                          |
| `file-tree`     | AI Element     | Collapsible folder/file tree + `pathsToFileTree`          |
| `hover-card`    | stock          | Base UI PreviewCard                                       |
| `input`         | stock          | Text input                                                |
| `input-group`   | stock          | Input/textarea with addons and buttons                    |
| `item`          | stock + ring   | List/board row; `outline` is ring + card bg               |
| `kbd`           | stock          | Keyboard key chip                                         |
| `label`         | stock          | Label                                                     |
| `plan`          | AI Element     | Plan steps on a Trace                                     |
| `popover`       | stock          | Popover                                                   |
| `progress`      | stock          | Progress bar                                              |
| `prompt-input`  | AI Element     | Textarea + submit form in an InputGroup                   |
| `resizable`     | stock          | react-resizable-panels v4 wrappers                        |
| `scroll-area`   | stock          | Base UI ScrollArea                                        |
| `select`        | stock          | Base UI Select (translucent)                              |
| `separator`     | stock          | Separator                                                 |
| `sheet`         | stock          | Side panel on Base UI Dialog                              |
| `sidebar`       | stock          | App sidebar system (provider, menu, rail…)                |
| `skeleton`      | stock          | Pulse placeholder                                         |
| `sonner`        | stock          | Toaster                                                   |
| `spinner`       | stock          | Loader icon                                               |
| `stack-trace`   | AI Element     | Failed error + frames on a Trace                          |
| `suggestion`    | AI Element     | Row of outline example-prompt buttons                     |
| `switch`        | stock          | Switch (sm/default)                                       |
| `table`         | stock + tweaks | Bordered rounded table, muted header, truncating cells    |
| `tabs`          | stock          | Tabs (default / line)                                     |
| `task`          | AI Element     | Task with steps on a Trace                                |
| `terminal`      | AI Element     | Command title + output CodeBlock on a Trace               |
| `textarea`      | stock          | Textarea                                                  |
| `toggle`        | stock          | Toggle button                                             |
| `toggle-group`  | stock          | Toggle group                                              |
| `tooltip`       | stock          | Tooltip with arrow                                        |
| `trace`         | AI Element     | Timeline lines + collapsible detail (base of Task, Plan…) |

## src/lib/utils.ts

```ts
export { cn } from "cn"
```

`cn` (npm `cn@0.5.2`, from shadcn-ui) is a compiled drop-in replacement
for `clsx` + `tailwind-merge`: `cn(...inputs: ClassValue[]): string` joins
truthy class values and resolves Tailwind conflicts (last wins). Most
component files import `cn` straight from `"cn"`; only `suggestion.tsx`
imports it via `@workspace/ui/lib/utils`.

## src/hooks/use-mobile.ts

```ts
export function useIsMobile(): boolean
```

`MOBILE_BREAKPOINT = 768`. Uses `React.useSyncExternalStore` with:
subscribe = `matchMedia("(max-width: 767px)")` `change` listener;
client snapshot = `window.innerWidth < 768`; server snapshot = `false`.
Used by `sidebar.tsx` (mobile sidebar renders in a Sheet).
