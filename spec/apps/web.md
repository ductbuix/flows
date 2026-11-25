# `apps/web` — Flows web UI

Path: `apps/web` (package name `web`). React 19 single-page app built with
Vite 8, Tailwind 4 and shadcn parts (Base UI, style `base-nova`) from
`@workspace/ui`. Talks to the local engine only through FCP (JSON-RPC 2.0)
via `@workspace/sdk` / `@workspace/sdk-react`; never REST, never
`hono/client`. Runs in a browser at `http://127.0.0.1:5173` (dev) or inside
the Electron renderer (`apps/desktop` loads the built `dist`).

The visual system (tokens, `globals.css`, every `@workspace/ui` part) is
specified separately with `packages/ui`; this spec names those parts and
lists only the class names apps/web passes to them.

## Spec index

| File                                                   | Covers                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| [web.md](web.md) (this file)                           | Package, config, lint rules, bootstrap, routing, FCP client, shared components, lib helpers, cross-cutting patterns |
| [web-settings-shell.md](web-settings-shell.md)         | `AppShell`, sidebar + nav, inbox badge/toasts, theme provider, text size, Settings panel                            |
| [web-docket.md](web-docket.md)                         | `/docket` board, columns, new card, card panel (refs, properties, links, assets, runs)                              |
| [web-inbox.md](web-inbox.md)                           | `/inbox`                                                                                                            |
| [web-workflows.md](web-workflows.md)                   | `/workflows` list + sheet, `/workflows/:id` editor page, save flow, shortcuts                                       |
| [web-workflows-canvas.md](web-workflows-canvas.md)     | React Flow canvas: nodes, ports, run overlay, settings, logs                                                        |
| [web-connectors-library.md](web-connectors-library.md) | `/connectors`, `/library`                                                                                           |
| [web-skills-files.md](web-skills-files.md)             | `/skills`, `/files`                                                                                                 |
| [web-dev-brand.md](web-dev-brand.md)                   | `/brand`, `/brand/:mockupId`, `/dev/kit`, dev-kit-only data components                                              |

Design rules for screens live in `apps/web/DESIGN.md` (summarised in
[§ Design rules](#design-rules)).

## package.json

```json
{
  "name": "web",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint",
    "typecheck": "tsc -b",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@codemirror/lang-markdown": "^6.5.2",
    "@codemirror/lang-yaml": "^6.1.3",
    "@codemirror/lint": "^6.9.8",
    "@codemirror/merge": "^6.12.3",
    "@codemirror/state": "^6.7.6",
    "@codemirror/view": "^6.43.15",
    "@dagrejs/dagre": "^3.1.3",
    "@uiw/react-codemirror": "^4.25.12",
    "@workspace/contracts": "workspace:*",
    "@workspace/protocol": "workspace:*",
    "@workspace/sdk": "workspace:*",
    "@workspace/sdk-react": "workspace:*",
    "@workspace/ui": "workspace:*",
    "@xyflow/react": "^13.0.2",
    "lucide-react": "^1.77.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-markdown": "^10.1.0",
    "react-router": "^8.5.2",
    "remark-gfm": "^4.0.1",
    "shiki": "^4.6.0",
    "sonner": "^2.0.8"
  },
  "devDependencies": {
    "@eslint/js": "^10",
    "@tailwindcss/vite": "^4",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/react": "^16.3.3",
    "@types/dagre": "^0.7.53",
    "@types/node": "^26",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6",
    "eslint": "^10",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.8",
    "globals": "^17",
    "jsdom": "^31.0.1",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8",
    "vite": "^8",
    "vitest": "^5.1.1"
  }
}
```

Dependencies actually imported by `src`: `@dagrejs/dagre` (canvas
auto-layout), `@xyflow/react`, `lucide-react`, `react`, `react-dom`,
`react-markdown` + `remark-gfm` (`SummaryMarkdown`), `react-router`,
`sonner`, the `@workspace/*` packages. **Not imported anywhere in
`apps/web/src`:** `@codemirror/*`, `@uiw/react-codemirror`, `shiki`
(declared only; the workflow YAML editor is a plain `Textarea`).
`@workspace/protocol` is used for `messagePortTransport` / `Transport`.

## Config files

### vite.config.ts

- Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`, and `flows-csp`
  (build only) which prepends to `<head>`:
  `<meta http-equiv="Content-Security-Policy" content="…">` with
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: flows-blob: https:; media-src 'self' blob: flows-blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* flows-blob:; object-src 'none'; base-uri 'none'; form-action 'none'`.
- `base`: `"./"` when `FLOWAPP_DESKTOP_BUILD === "1"` (Electron `loadFile`), else `"/"`.
- `resolve.alias`: `@` → `./src`; `@workspace/contracts` → `../../packages/contracts/src/index.ts`.
- `server.host: "127.0.0.1"` (port default 5173). Proxy target `http://127.0.0.1:${PW_API_PORT ?? "8787"}`:
  - `/fcp` → `changeOrigin: true, ws: true` (bootstrap GET and the WebSocket upgrade; changeOrigin so the daemon's loopback Host check passes).
  - `/blobs` → `changeOrigin: true`.

### vitest.config.ts

`mergeConfig(viteConfig, { test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"] } })`.

### tsconfig

- `tsconfig.json`: references `tsconfig.app.json` and `tsconfig.node.json`; `paths` `@/*` → `./src/*`, `@workspace/ui/*` → `../../packages/ui/src/*`, `@workspace/contracts` → contracts `src/index.ts`.
- `tsconfig.app.json`: `target es2023`, `lib ["ES2023","DOM"]`, `module esnext`, `types ["vite/client"]`, `allowArbitraryExtensions`, `skipLibCheck`, `moduleResolution bundler`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `moduleDetection force`, `noEmit`, `jsx react-jsx`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`, same `paths`; `include ["src"]`; build info in `node_modules/.tmp`.
- `tsconfig.node.json`: same strictness for `vite.config.ts` and `vitest.config.ts`, `module nodenext`, `types ["node"]`.

### components.json (shadcn CLI)

`style "base-nova"`, `rsc false`, `tsx true`, tailwind css `../../packages/ui/src/styles/globals.css`, `baseColor "neutral"`, `cssVariables true`, `iconLibrary "lucide"`, aliases `components @/components`, `hooks @/hooks`, `lib @/lib`, `utils @workspace/ui/lib/utils`, `ui @workspace/ui/components`, `menuColor "default-translucent"`, `menuAccent "subtle"`.

### index.html

`<html lang="en">`, charset UTF-8, `<link rel="icon" type="image/svg+xml" href="/vite.svg">` (no `public/` folder exists, so the icon 404s), viewport meta, `<title>vite-monorepo</title>`, `<div id="root">`, `<script type="module" src="/src/main.tsx">`.

### eslint.config.js

Flat config (`defineConfig`):

1. `globalIgnores(["dist"])`; `noCycleBlock` from root `eslint-dependency-guards.mjs`.
2. `**/*.{ts,tsx}`: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`; browser globals; `react-refresh/only-export-components` off; `webRestrictedImports`: bans `hono/client` ("web must use FCP via sdk-react, not hono/client"), `server/app`, any `@workspace/core*`, `@workspace/engine*`, `@workspace/adapters-*` ("web must not import core, engine or adapters"), and `pages/mock`.
3. `src/**` (non-test): `no-restricted-syntax` from `eslint-tailwind-guard.js` — bans arbitrary Tailwind values (`foo-[...]`) except under `data-`/`aria-`/`has-`/`group-` variants, and palette colors (`text|bg|border|ring|outline|fill|stroke|from|to|via-<red|blue|…|white|black>`); rule `tailwind-guard/no-ui-size-radius-class` — no `h-*`, `size-*`, `rounded-*` className tokens on components imported from `@workspace/ui` (except `h-auto` on `Button`, and `h-*` on `Skeleton`, `ScrollArea`, `SidebarInset`, `Separator`, `Tabs`, `TabsContent`, `ResizablePanelGroup`, `ResizablePanel`; files under `components/ai-elements/` exempt).
4. `src/**` (non-test): `eslint-ui-guards.js` plugin `ui-guard`:
   - `dense-size`: `size="sm"|"xs"|"icon-sm"|"icon-xs"` on `@workspace/ui` parts only inside `TableCell`, `TableHead`, `ItemActions`, `InputGroupAddon`, `CodeBlockHeader` or any `Sidebar*` ancestor (Card/Item `size` exempt; files matching `Graph|Node|IdText.tsx` or `ai-elements/` exempt).
   - `dialog-width`: `DialogContent` width classes only `sm:max-w-md` or `sm:max-w-xl`; `SheetContent` / `AlertDialogContent` no width tokens (the `data-[side=right]:sm:max-w-*` form escapes this rule by its variant prefix).
   - `mono`: `font-mono` only in `components/data/`, `components/ai-elements/` (use the `mono` constant elsewhere).
   - `frame-padding`: `p-6`/`px-6`/`py-6` only in `components/page/`.
5. `src/pages/**`: `page-frame-tags` (no `<main>` / `<header>` in pages) and `no-time-format` (no `.toISOString()`, `.toLocaleString()`, `.toLocaleDateString()` in pages; use `RelativeTime` / `lib/labels`).
6. `max-lines` warn 200 (tests 300), skipping blanks and comments.

## Source tree

```
src/
  main.tsx                     bootstrap
  App.tsx                      routes
  lib/                         create-app-client, browser-host, desktop-host, flows-desktop.d.ts,
                               fcp-error, labels, text-size, upload-blob
  components/
    shell/                     AppShell, AppSidebar, nav
    page/                      Page, PageHeader, PageSection, PageTitle, PageToolbar, index
    brand/                     StatusPill, KindAvatar, StatRow
    data/                      mono, RelativeTime, IdText, RunStatusBadge, ImpactBadge,
                               FreshnessBadge, PublishPolicyBadge, EnvironmentVariables
    runs/                      RunSheet, RunSheetContent, run-actions, status
    disk-picker/               DiskPicker, index
    ai-elements/               model-selector
    ConfirmDialog, FilesTree, FlowsClientGate, InboxNavBadge, InboxToasts,
    SummaryMarkdown, theme-provider
  pages/
    docket/ inbox/ workflows/ workflows/canvas/ connectors/ library/
    skills/ files/ settings/ brand/ brand/mockups/ DevKitPage.tsx
```

## Bootstrap (`main.tsx`)

1. `import "@workspace/ui/globals.css"`.
2. `applyTextSize(readTextSize())` (root font-size before render).
3. `Router = isDesktopRenderer() ? HashRouter : BrowserRouter` (Electron loads a file URL, so hash routing).
4. `boot()`: `client = await createAppClient()`; if a client exists, `await client.ready` (errors swallowed: pages show their own connection state).
5. Render:

```tsx
<StrictMode>
  <ThemeProvider defaultTheme="light">
    <TooltipProvider>
      {" "}
      {/* @workspace/ui/components/tooltip */}
      <Router>
        {client ? (
          <FlowsClientProvider client={client}>
            <App />
          </FlowsClientProvider>
        ) : (
          <App />
        )}
      </Router>
    </TooltipProvider>
  </ThemeProvider>
</StrictMode>
```

If no client could be created (no desktop preload, no bootstrap), the app
still renders; each page wraps itself in `FlowsClientGate`, which retries
`createAppClient()` and shows **Connecting…** / **Could not connect**.

## Routing (`App.tsx`)

React Router v8 `<Routes>`; one layout route with `AppShell`:

| Path              | Element                                             | Spec                                                   |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------ |
| index (`/`)       | `<Navigate to="/docket" replace />`                 |                                                        |
| `docket`          | `DocketPage` (`?card=<id>` opens a card)            | [web-docket.md](web-docket.md)                         |
| `workflows`       | `WorkflowsPage`                                     | [web-workflows.md](web-workflows.md)                   |
| `workflows/:id`   | `WorkflowEditorPage` (`?run=<runId>` follows a run) | [web-workflows.md](web-workflows.md)                   |
| `inbox`           | `InboxPage`                                         | [web-inbox.md](web-inbox.md)                           |
| `files`           | `FilesPage`                                         | [web-skills-files.md](web-skills-files.md)             |
| `library`         | `LibraryPage` (`?item=<id>` opens an item)          | [web-connectors-library.md](web-connectors-library.md) |
| `skills`          | `SkillsPage`                                        | [web-skills-files.md](web-skills-files.md)             |
| `connectors`      | `ConnectorsPage` (`?connector=<id>` opens one)      | [web-connectors-library.md](web-connectors-library.md) |
| `dev/kit`         | `DevKitPage` — only when `import.meta.env.DEV`      | [web-dev-brand.md](web-dev-brand.md)                   |
| `brand`           | `BrandPage`                                         | [web-dev-brand.md](web-dev-brand.md)                   |
| `brand/:mockupId` | `BrandMockupPage`                                   | [web-dev-brand.md](web-dev-brand.md)                   |

There is no catch-all: unknown paths (e.g. `/settings`, `/mock/docket`)
render nothing at all (not even the shell). URL query params are read once
into local state on mount; only the editor's `?run=` is written back.

## FCP client wiring

### `lib/create-app-client.ts`

```ts
export function createAppClient(): Promise<FlowsClient | null>
export function isDesktopRenderer(): boolean // !!window.flowsDesktop?.connect
```

`CLIENT_INFO = { name: "flows-web", version: "0.0.1" }`.

1. `window` undefined → `null`.
2. **Electron** (`window.flowsDesktop?.connect`): `createClient({ transport: () => openDesktopTransport(), clientInfo, capabilities: desktopClientCapabilities() })`, then `installDesktopHost(client)`. `openDesktopTransport()` adds a `message` listener on `window`, calls `flowsDesktop.connect()`, and resolves with `messagePortTransport(event.ports[0])` for the first message whose `source === window` and `data.type === "flows-fcp-local-port"`; rejects after 10 s with `flowsDesktop.connect: timed out waiting for port`. The transport factory is called again on reconnect.
3. **Browser**: bootstrap = `window.__FLOWS_FCP__` (`{url, token}`) if it has `url`, else `GET /fcp/bootstrap` → JSON `{ url, token }` (non-OK, missing url, or network error → null). With bootstrap: `createClient({ url, token, clientInfo, capabilities: browserClientCapabilities })` (WebSocket) and `installBrowserHost(client)`.
4. Otherwise `null`.

`createClient` (from `@workspace/sdk`) provides `ready: Promise<InitializeResult>` (with `workspace.home`, `engineCapabilities.blobs?.http`), `call(method, params)`, `onNotification(name, cb) → unsubscribe`, `onRequest(method, handler) → unsubscribe`, `on("resync", cb)`, `close()`; it queues calls, reconnects with backoff, and re-subscribes/resyncs.

### `lib/browser-host.ts`

`browserClientCapabilities = { host: { revealPath: true } }`. `installBrowserHost(client)` → after `ready`, handles engine request `host/reveal_path` by storing `params.path` on `window.__FLOWS_LAST_REVEAL__` and returning `{}` (lets e2e assert `file/reveal`). Returns a disposer.

### Desktop host

`lib/desktop-host.ts`: `desktopClientCapabilities()` → `{ host: { revealPath: true, notifications: true, browserSignIn: true } }`.
`installDesktopHost(client)` no-ops unless the preload exposes `revealPath`, `notifyInboxItem` and `browserSignIn`. After `ready`:

- `host/reveal_path` → `flowsDesktop.revealPath(path)`; returns `{}`.
- `host/browser_sign_in` → returns `flowsDesktop.browserSignIn(params)` (`{connectorId, url, cookieDomains}` → `{cookies[]}` or `{cancelled: true}`).
- `call("subscribe", { topics: ["inbox", "notice"] })`.
- `inbox/update` with `kind === "item_added"` → `notifyInboxItem({ title, body: item.question })`; titles as in InboxToasts (Approval needed, Permission needed, Question from an agent, Plan needs review, Sign-in needed).
- `notice/update` with `notice.channel === "system"` → `notifySystem?.({ title: notice.title, body })` where body = first non-empty, non-`#` line of `notice.text`, cut to 200 chars.
- Disposer unsubscribes all and calls `unsubscribe` for both topics.

### `lib/flows-desktop.d.ts` (global types)

`window.flowsDesktop?: { connect(): void; revealPath(path): void; notifyInboxItem({title, body}): void; notifySystem?({title, body}): void; browserSignIn({connectorId, url, cookieDomains}): Promise<{cookies: {name, value, path, domain?, expires?, httpOnly?, secure?, sameSite?: "Strict"|"Lax"|"None"}[]} | {cancelled: true}> }`;
`window.__FLOWS_FCP__?: { url: string; token: string }`;
`window.__FLOWS_LAST_REVEAL__?: string`.

### sdk-react hooks used

| Hook                                   | Behaviour relied on                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FlowsClientProvider({client})`        | Context                                                                                                                                                                                                                                                                                                                                                                             |
| `useFlowsClient()`                     | Throws without provider                                                                                                                                                                                                                                                                                                                                                             |
| `useOptionalFlowsClient()`             | `FlowsClient \| null`                                                                                                                                                                                                                                                                                                                                                               |
| `useQuery(method, params, { topics })` | Returns `{ data, error, loading }`. Fetches on mount and whenever `JSON.stringify(params)` changes; ref-counted `subscribe` of each topic; refetches on any `<namespace>/update` notification matching a topic (`docket` ↔ `docket/update`; `run:<id>` ↔ `run/update`) and on `resync`. `data` is kept during refetch (so pages test `loading && !data`). `topics: []` = fetch once |
| `useSubscription(topic, handler)`      | Subscribes the topic and forwards every `<namespace>/update` params to `handler`                                                                                                                                                                                                                                                                                                    |

Topics used: `docket`, `workflow`, `run`, `run:<runId>`, `inbox`, `library`, `connector`, `skill` (+ `notice` by desktop host).

### Blob upload (`lib/upload-blob.ts`)

```ts
export type UploadedBlob = {
  id: string
  name: string
  size: number
  mime: string
}
export function uploadBlob(
  client,
  opts: {
    scope: string
    name: string
    body: Blob | ArrayBuffer | string
    mime?: string
  }
): Promise<UploadedBlob>
```

Requires `(await client.ready).engineCapabilities.blobs?.http` (else throws **Blob upload is not available on this host**). Token from `window.__FLOWS_FCP__.token` or `GET /fcp/bootstrap` (errors: **Could not load FCP bootstrap for blob upload**, **FCP bootstrap has no token**). `PUT /blobs?token=…&scope=…&name=…` with `content-type: mime ?? application/octet-stream`; non-OK → **Blob upload failed (<status>)**; returns the JSON body. Used only by the docket "Add asset from disk" dialog.

## lib helpers

### `fcp-error.ts`

```ts
export function isConflictError(err: unknown): boolean // err.code === ErrorCode.conflict || err.data?.code === "conflict"
export function errorMessage(err: unknown): string // Error.message or String(err)
```

### `labels.ts`

```ts
export function humanizeId(id: string): string // "-"/"_" runs → space, trim, capitalise first letter; empty → id
export function workflowLabel(s: { id: string; name?: string }): string // trimmed name, else humanizeId(id)
export function runLabel(run: { cardTitle?: string | null }): string // title or "Ad hoc run"
export function formatRelative(iso: string, now = Date.now()): string
export function formatAbsolute(iso: string): string
export function formatDuration(ms: number): string
```

- `formatRelative`: invalid → input; `< 45 s` **just now**; `< 1 h` **N min ago** (min 1); `< 24 h` **N h ago**; calendar-day difference 1 → **yesterday**; else `toLocaleDateString(undefined, { month: "short", day: "numeric", year? })` (year only when different from now).
- `formatAbsolute`: `toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" })`; invalid → input.
- `formatDuration`: `45s`, `3m 05s`, `2h 10m`.

### `text-size.ts`

See [web-settings-shell.md § Text size](web-settings-shell.md#text-size-libtext-sizets).

## Page frame

`components/page/` — every route renders exactly one `Page`.

| Component     | Signature                                                                                    | Markup                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Page`        | `{ crumbs: Crumb[]; actions?: ReactNode; fill?: boolean; "data-testid"?: string; children }` | `div.flex.min-h-0.flex-1.flex-col` (testid here) → `PageHeader` + content `div` `@container/main flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6 overflow-auto` with `[&>[data-bleed]]:-mx-4 lg:[&>[data-bleed]]:-mx-6` (+ `min-h-0` when `fill`, so the last region can take remaining height with `min-h-0 flex-1`)                                                                                                                                       |
| `PageHeader`  | `{ crumbs; actions? }`, `type Crumb = { label: string; to?: string }`                        | `header.flex.h-(--header-height).shrink-0.items-center.border-b` (`--header-height` = `calc(var(--spacing) * 12)` from globals) → `div.flex.w-full.items-center.px-4.lg:px-6`: `SidebarTrigger.-ml-1 data-testid="sidebar-trigger"`, vertical `Separator.mx-2.h-4.data-vertical:self-auto`, `Breadcrumb.min-w-0` (last crumb or crumbs without `to` → `BreadcrumbPage`; others `BreadcrumbLink render=<Link>`), actions in `div.ml-auto.flex.shrink-0.items-center.gap-2` |
| `PageTitle`   | `{ title: string; description: ReactNode; badge?: ReactNode }`                               | `div.flex.flex-col.gap-1` → `h1.font-heading.text-xl.font-medium` (+ badge, `flex flex-wrap items-center gap-2`) and `div.flex.flex-wrap.items-center.gap-x-2.text-sm.text-muted-foreground`                                                                                                                                                                                                                                                                              |
| `PageSection` | `{ title: string; toolbar?: ReactNode; children }`                                           | `section.flex.flex-col.gap-3` → `div.flex.min-h-8.items-center.justify-between.gap-2` with `h2.font-heading.text-base.font-medium` + `PageToolbar`                                                                                                                                                                                                                                                                                                                        |
| `PageToolbar` | `{ children }`                                                                               | `div.flex.items-center.gap-2`                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Shared components

### FlowsClientGate (`components/FlowsClientGate.tsx`)

`FlowsClientGate({ children })`: if a client is already in context, renders children. Otherwise creates one with `createAppClient()` and awaits `ready` (closes it on unmount):

- Pending: `<Page crumbs=[{label:"Connecting"}] data-testid="fcp-loading">`, `PageTitle` **Connecting…** / **Waiting for the local engine.**, `Skeleton h-8 w-48` + `h-40 w-full`.
- Error (null client → **Could not load FCP bootstrap**, or ready failure): `data-testid="fcp-error"`, `PageTitle` **Could not connect** / message + destructive `Alert` **Could not connect** / message.
- Ready: `FlowsClientProvider` around children.

**Gate pattern** (every data page): `XPage()` returns `<XPageInner/>` when `useOptionalFlowsClient()` is set, else `<FlowsClientGate><XPageInner/></FlowsClientGate>`.

### ConfirmDialog (`components/ConfirmDialog.tsx`)

Props `{ open, onOpenChange, title, description: ReactNode, confirmLabel, cancelLabel = "Cancel", onConfirm, pending? }`. `AlertDialogContent data-testid="confirm-dialog"` with header title/description and footer: `AlertDialogCancel data-testid="confirm-cancel"` and `AlertDialogAction variant="destructive" data-testid="confirm-ok"` (click `preventDefault()` so the parent decides when to close, then `onConfirm`). Both disabled while `pending`.

### SummaryMarkdown (`components/SummaryMarkdown.tsx`)

`SummaryMarkdown({ text })` → `div.max-w-none data-testid="summary-markdown"` with `ReactMarkdown remarkPlugins={[remarkGfm]}` (no raw HTML; script tags render as text). Component map: `h1` `mt-4 mb-2 font-heading text-xl font-medium first:mt-0`; `h2` same with `text-base`; `h3` `mt-3 mb-1 text-sm font-medium`; `p` `my-2 text-sm`; `ul` `my-2 list-disc pl-5 text-sm`; `ol` `my-2 list-decimal pl-5 text-sm`; tables → ui `Table` (`my-2`), `TableHeader/Body/Row/Head/Cell`; `a` with `javascript:` href → plain `<span>`; `pre` → `CodeBlock.my-2 > CodeBlockContent wrap` with the flattened fence text; `code` with `language-*` → plain `<code>`; inline code → `code.font-mono.rounded-md.bg-muted.px-1.py-0.5.text-xs`. Used by the Files markdown preview.

### FilesTree and DiskPicker

- `FilesTree`, `folderPaths`: see [web-skills-files.md § FilesTree](web-skills-files.md#filestree-componentsfilestreetsx-shared). Nodes come from `pathsToFileTree(paths)` in `@workspace/ui/components/file-tree` (`FileNode = {type:"file", name, path} | {type:"folder", name, path, children}`, folders sorted before files).
- `components/disk-picker` exports `DiskPicker`, `DiskPickerBoth`, `pickFromFiles`, `DiskPick`:
  - `DiskPick = { label; folder: boolean; entries: { path; file: File }[] }`. `pickFromFiles(files, folder)` → null when empty; path = `webkitRelativePath || name` for folders; label = first path segment (folder) or file name.
  - `DiskPicker({ value, onPick, mode: "file"|"folder", preview = true })`: outline Button (`disk-choose-file` `File` **Choose file…** / `disk-choose-folder` `FolderOpen` **Choose folder…**) clicking a hidden `<input type=file>` (`disk-file-input` / `disk-folder-input`; folder mode sets `webkitdirectory` and `multiple`; value reset after each pick). Preview box when `value.folder` matches mode.
  - `DiskPickerBoth({ value, onPick, chosenNote = "copied into its own Library folder", emptyHint = "Nothing chosen. Files are copied into the Library; the originals stay where they are." })`: `div.flex.flex-col.gap-2 data-testid="disk-picker"`; both buttons in a row; when chosen a box `flex flex-col gap-1 rounded-2xl p-3 ring-1 ring-foreground/10` with `p.text-sm` (mono label + muted ` · folder, N files` or ` · file` + ` · <chosenNote>`) and a fully expanded read-only `FilesTree` of the first 60 paths in `max-h-40 overflow-y-auto`; else `p.text-sm.text-muted-foreground` hint.

### Runs (`components/runs/`)

- `status.ts` `statusOf(status: RunStatus, needsYou: boolean) → { tone, label }`: needsYou → attention **Needs you**; queued idle **Queued**; running working **Running**; succeeded done **Done**; failed failed **Failed**; cancelled idle **Cancelled**.
- `run-actions.ts` (all with `requestKey: crypto.randomUUID()`; result `{ ok: true; runId? } | { ok: false; kind: "conflict"|"error"; message }`):
  `startRun(client, { workflowId, values?, cardId? })` → `run/start` (returns `runId`); `cancelRun(client, runId)` → `run/cancel {runId}`; `rerunRun` → `run/rerun {runId}` (returns new `runId`); `deleteRun` → `run/delete {runId}`; `retryStep(client, runId, stepId)` → `run/retry_step {runId, stepId}`.
- `RunSheet({ runId, onClose, onReran(runId), onDeleted, onConflict, onError })`: `Sheet open={runId !== null}`, `SheetContent className="data-[side=right]:sm:max-w-lg" data-testid="runs-sheet" data-run-id`. Body (keyed by runId) queries `run/get {id}` topic `run:<id>`; ignores late action results after unmount.
  - Loading `div.space-y-3 data-testid="runs-sheet-loading"` (`Skeleton h-8 w-48`, `h-24 w-full`); error Alert `runs-sheet-error` **Error** / message or **Run not found.**
  - `RunSheetContent`: header title `workflowName || workflowId` + `StatusPill`; description mono run id · **started <RelativeTime>** · **done/total steps**. Actions `mt-4 flex flex-wrap items-center gap-2`: live (running/queued) → outline `runs-cancel` (`Square`) **Cancel** opening confirm; else `runs-rerun` (`RotateCcw`) **Run again**. Outline icon menu `runs-menu` (**More**, `MoreHorizontal`) with destructive item `runs-delete` **Delete run** (disabled and labelled **Cancel the run before deleting it** while live). When needsYou: `p.mt-4.text-sm.text-muted-foreground` **Waiting on N approval(s). Answer them in Inbox.** Confirms: **Cancel this run?** / **Running tasks are stopped. Finished outputs are kept.** / **Cancel run** / cancel label **Keep running**; **Delete this run?** / **Removes the run directory and drops it from lists. Cannot be undone.** / **Delete run** (delete closes the sheet).
  - Used by the docket card Runs section.

### Brand blocks (`components/brand/`)

| Block        | API                                                                                                               | Notes                                                                                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatusPill` | `{ tone: Tone; children; className?; "data-testid"? }`, `Tone = "working"\|"done"\|"failed"\|"attention"\|"idle"` | `Badge variant="outline"` + `TONE_CLASS[tone]`, `data-tone`. Icon first: working → `span.size-1.5.animate-pulse.rounded-full.bg-current`; done `Check`; failed `CircleX`; attention `CircleAlert.text-warning`; idle `Clock`                                                            |
| `TONE_CLASS` |                                                                                                                   | working `border-info/25 bg-info/10 text-info`; done `border-success/25 bg-success/10 text-success`; failed `border-destructive/25 bg-destructive/10 text-destructive`; attention `border-warning/30 bg-warning/15 text-foreground`; idle `border-border bg-muted text-muted-foreground` |
| `TONE_TEXT`  |                                                                                                                   | working `text-info`, done `text-success`, failed `text-destructive`, attention `text-warning`, idle `text-muted-foreground`                                                                                                                                                             |
| `KindAvatar` | `{ kind?: "solid"\|"soft"\|"info"\|"success"\|"warning" = "soft"; size?: "sm"\|"default"\|"lg"; children }`       | `Avatar size` + `AvatarFallback` tint: solid `bg-primary text-primary-foreground`; soft `bg-muted text-foreground`; info `bg-info/10 text-info`; success `bg-success/10 text-success`; warning `bg-warning/15 text-warning`. Used only by brand mockups                                 |
| `StatRow`    | `{ stats: { label; value }[] }`                                                                                   | `dl.flex.items-stretch`; each `div.flex.flex-col.gap-0.5.px-4` (first `pl-0`, others `border-l`), `dt.text-xs.text-muted-foreground`, `dd.font-mono.text-base.tabular-nums`                                                                                                             |

### Data blocks (`components/data/`)

- `mono.ts`: `export const mono = "font-mono"` — the only allowed way to apply monospace outside `components/data` and `ai-elements`.
- `RelativeTime({ value: iso, className?, "data-testid"? })`: `Tooltip` whose trigger renders `<time dateTime>` with `formatRelative(value, now)`; content `formatAbsolute(value)`; `now` refreshes every 30 s.
- `IdText({ id, copy = true })`: mono `text-xs text-muted-foreground` (`data-testid="id-text"`), UUIDs shortened to 8 chars with full id as `title`; ghost `icon-xs` copy Button (`-my-1`, `aria-label="Copy id"`, tooltip **Copy id**) → clipboard + `toast.success("Copied")` / `toast.error("Could not copy")`. Currently unused by screens.
- `RunStatusBadge`, `ImpactBadge`, `FreshnessBadge`, `PublishPolicyBadge`, `EnvironmentVariables`, and `ai-elements/model-selector` are only used on `/dev/kit`; see [web-dev-brand.md](web-dev-brand.md#data-components-used-only-here).

## Cross-cutting patterns

| Pattern                | Shape                                                                                                                                                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page states            | Each area has `XLoading` (Page + `PageTitle` "Loading …" + Skeletons in final shape, `data-testid="<area>-loading"`), `XLoadError` (`PageTitle` "Could not load …" + destructive Alert **Error**, `<area>-error`), empty `Empty` (page empties no ring; section empties `ring-1 ring-foreground/10`) |
| Action feedback        | Page-level destructive Alert `<area>-conflict` with title **Conflict** (FCP conflict, from `isConflictError`) or **Could not update/save** (other errors); setting one clears the other                                                                                                              |
| Optimistic concurrency | Mutations send `baseHash` (`docket/*`, `workflow/save`, `connector/*`, `file/write_text`); conflicts never auto-merge, the UI asks the user to close/reload                                                                                                                                          |
| Idempotency            | `run/*`, `library/*`, `skill/save`, `workflow/rename` send `requestKey: crypto.randomUUID()`                                                                                                                                                                                                         |
| Detail                 | Right `Sheet` (`data-[side=right]:sm:max-w-lg`, docket card `sm:max-w-5xl`), body keyed by id, header `pr-12`                                                                                                                                                                                        |
| Dialog widths          | `DialogContent` `sm:max-w-md` (forms) or `sm:max-w-xl` (columns, providers)                                                                                                                                                                                                                          |
| Confirm                | `ConfirmDialog` with destructive confirm                                                                                                                                                                                                                                                             |
| Live data              | `useQuery` + topics; no polling anywhere except `RelativeTime` 30 s tick                                                                                                                                                                                                                             |
| Copy                   | Sentence case; verb + object buttons; times via `RelativeTime`                                                                                                                                                                                                                                       |

## Design rules

Summary of `apps/web/DESIGN.md` (normative for new work):

- Product shape: Docket and Workflows are the two main pages; other routes remain reachable. `/brand` is a reference page.
- Principles: say what is true now; one primary (filled) action per surface; results over logs; neutral surfaces, color only for state; ask-style forms (≤5 fields); open details in a right Sheet.
- Tokens only (`background`, `muted`, `primary`, `info`, `success`, `warning`, `destructive`); tint recipe bg `/10` (warning `/15`), border `/25`, full text; warning text stays `text-foreground`. Tones map only via `TONE_CLASS`/`TONE_TEXT`.
- Type: `font-heading` medium headings; page title `text-xl`, card title `text-base`, body `text-sm`, meta `text-xs text-muted-foreground`; numbers `mono tabular-nums`.
- Shape: radius `--radius: 0.75rem`; ring-only surfaces (`ring-1 ring-foreground/10`); flat (no shadows); inputs keep `border-input`; lanes/canvas stage are the only hand-rolled surfaces (`rounded-2xl`/`rounded-3xl`); never override part sizes/radius; `d` toggles dark.
- Icons: lucide only, `size-4` inline; object icons via `KindAvatar`.
- Sourcing order: `packages/ui` parts → shadcn → AI Elements → custom (only `StatusPill`, `KindAvatar`, `StatRow`, `Button size="pill"`, `bg-dot-grid`).
- Every surface shows empty, loading, live, needs-you, failed, done, and dark mode.

## Tests (behaviour notes)

Vitest (jsdom) unit tests cover: route shell (`/` → docket with sidebar and `fcp-loading|fcp-error`; `/mock/*` and `/settings` render no shell; settings opens as a panel with `theme-toggle`; `/brand` renders), `SummaryMarkdown` safety, desktop/browser host wiring, `createAppClient` transport choice, `fcp-error`, `labels`, `upload-blob`, tailwind/ui guard rules, and the pure helpers of each area (listed in each area spec). Playwright e2e lives in `apps/e2e/tests/*.spec.ts` (brand, connectors, dev-kit, docket, docket-panel, docket-runs, files, inbox, layout baselines, library, runs, shell-smoke, sidebar-settings, skills, workflows, workflows-canvas, workflows-run, workflows-sheet, agent-acp-ask) and depends on the `data-testid` values given in these specs.
