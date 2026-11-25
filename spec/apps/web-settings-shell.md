# apps/web — App shell, sidebar, notifications and Settings panel

Part of the [web spec](web.md). Files: `src/components/shell/*`,
`src/components/InboxNavBadge.tsx`, `src/components/InboxToasts.tsx`,
`src/components/theme-provider.tsx`, `src/lib/text-size.ts`,
`src/pages/settings/*` (5 files). Settings is a right Sheet opened from the
sidebar footer; there is no `/settings` route.

## AppShell (`components/shell/AppShell.tsx`)

Layout route element (`<Route element={<AppShell/>}>` wraps every page).

```tsx
<SidebarProvider>
  <AppSidebar onOpenSettings={() => setSettingsOpen(true)} />
  <SidebarInset className="flex h-svh flex-col overflow-hidden">
    <Outlet />
  </SidebarInset>
  <InboxToasts />
  <Toaster /> {/* @workspace/ui/components/sonner */}
  <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
</SidebarProvider>
```

Local state: `settingsOpen` (boolean). The inset is a full-viewport-height
flex column; each page's `Page` frame takes `flex-1` inside it and scrolls
its own content.

## AppSidebar (`components/shell/AppSidebar.tsx`)

Props: `onOpenSettings: () => void`. Based on shadcn "sidebar-11" block.

- `Sidebar data-testid="app-sidebar"` (default variant/collapsible from `packages/ui`).
- `SidebarHeader` → one `SidebarMenuButton render=<Link to="/docket">` containing `span.font-heading.font-medium` **Flows**.
- `SidebarContent` → `SidebarGroup` with `SidebarGroupLabel` **Changes** → `SidebarMenu` of `APP_NAV` items: `SidebarMenuButton render=<Link to={to}> isActive={pathname === to}` with the icon and label. The **Inbox** item also renders `InboxNavBadge` after the button.
- `SidebarFooter` → `SidebarMenuButton data-testid="settings-open"` (`Settings` icon) **Settings** → `onOpenSettings`.
- `SidebarRail`.

Active state is an exact pathname match, so `/workflows/:id` does not highlight **Workflows**.

### nav.ts

```ts
export const APP_NAV: readonly { to: string; label: string; icon: LucideIcon }[]
```

| to            | label      | lucide icon       |
| ------------- | ---------- | ----------------- |
| `/docket`     | Docket     | `ListTodo`        |
| `/workflows`  | Workflows  | `RouteArrowRight` |
| `/inbox`      | Inbox      | `Inbox`           |
| `/files`      | Files      | `Folder`          |
| `/library`    | Library    | `Library`         |
| `/skills`     | Skills     | `BrainCog`        |
| `/connectors` | Connectors | `Link2`           |

`/brand` and `/dev/kit` are not in the sidebar.

## InboxNavBadge (`components/InboxNavBadge.tsx`)

- Without a client (`useOptionalFlowsClient()` null): empty `SidebarMenuBadge data-testid="inbox-badge"`.
- With a client: `useQuery("inbox/list", {}, { topics: ["inbox"] })`; badge shows `items.length` when > 0, else empty.

## InboxToasts (`components/InboxToasts.tsx`)

Renders nothing. Only active with a client. `useSubscription("inbox", onUpdate)`:

- Ignores params unless `kind === "item_added"`; validates `item` with `inboxItemSchema.safeParse`; ignores non-`open` items.
- Title by kind: approval **Approval needed**; permission **Permission needed**; question **Question from an agent**; plan_review **Plan needs review**; sign_in **Sign-in needed**.
- `toast(title, { id: item.id, description: item.question, action: { label: "Review", onClick: navigate(to) } })` where `to = /workflows/<workflowId>?run=<runId>` for non-sign-in items with a workflow, else `/inbox`. Using the item id as toast id dedupes repeats.

The Electron host additionally raises OS notifications (see [web.md § desktop host](web.md#desktop-host)).

## ThemeProvider (`components/theme-provider.tsx`)

```ts
type Theme = "dark" | "light" | "system"
export function ThemeProvider(props: { children; defaultTheme?: Theme = "system"; storageKey?: string = "theme"; disableTransitionOnChange?: boolean = true }): JSX.Element
export const useTheme: () => { theme: Theme; setTheme(theme: Theme): void }   // throws outside provider
```

- Mounted in `main.tsx` with `defaultTheme="light"` (so first run is light).
- Initial theme from `localStorage["theme"]` when valid, else default.
- Applying: resolves `system` via `matchMedia("(prefers-color-scheme: dark)")`; removes `light`/`dark` classes from `<html>` and adds the resolved one. While applying, injects a temporary `<style>` disabling all transitions, removed after two animation frames.
- When theme is `system`, listens to the media query and re-applies on change.
- `setTheme` writes `localStorage` then state.
- Keyboard: global `keydown` of `d` (case-insensitive) without Meta/Ctrl/Alt, not repeated, not in an editable target (`input, textarea, select, [contenteditable='true']` or contentEditable) toggles: dark → light, light → dark, system → opposite of the current system scheme; persisted.
- Cross-tab sync: `storage` event for the key sets the theme (invalid value → default).

## Text size (`lib/text-size.ts`)

```ts
export const TEXT_SIZES = ["small", "default", "large"] as const
export type TextSize = (typeof TEXT_SIZES)[number]
export function isTextSize(value: unknown): value is TextSize
export function readTextSize(): TextSize // localStorage["text-size"], default "default", storage errors → default
export function applyTextSize(size: TextSize): void // document.documentElement.style.fontSize
export function saveTextSize(size: TextSize): void // apply + persist (storage errors ignored)
```

Root font size: small `87.5%`, default `100%`, large `112.5%` (all Tailwind
sizes are rem-based, so the whole UI scales). `main.tsx` calls
`applyTextSize(readTextSize())` before the first render.

## SettingsPanel (`pages/settings/SettingsPanel.tsx`)

Props: `open, onClose`.

- `Sheet open onOpenChange(!o → onClose)`; `SheetContent className="overflow-y-auto data-[side=right]:sm:max-w-lg" data-testid="settings-panel"`.
- `SheetHeader className="pr-12"`: title **Settings**; description **Theme, text size, agent CLIs, always-trust and allowed MCP servers.**
- Body `div.flex.flex-col.gap-6.px-4.pb-6`: `SettingsThemeSection`, `SettingsTextSizeSection`, and `SettingsTrustBody` only while `open` (so its queries run only when the panel is open and refetch on each open).

Sections use `PageSection` (h2 row + `gap-3` content).

### SettingsThemeSection

`PageSection "Theme"` → `Field`:

- `ToggleGroup value=[theme] variant="outline" data-testid="theme-toggle"` with items **Light** (`light`), **Dark** (`dark`), **System** (`system`) → `setTheme`.
- `FieldDescription data-testid="theme-shortcut-hint"`: **Default is light. Press <Kbd>d</Kbd> to toggle light and dark.**

### SettingsTextSizeSection

`PageSection "Text size"` → `Field`: `ToggleGroup variant="outline" data-testid="text-size-toggle"` with **Small** (`text-size-small`), **Default** (`text-size-default`), **Large** (`text-size-large`) → `saveTextSize` + local state (initial `readTextSize()`). `FieldDescription` **Scales all text in the app. Saved on this device.**

### SettingsTrustBody (`SettingsTrustSections.tsx`)

- Without a client: `p.text-sm.text-muted-foreground data-testid="settings-fcp-wait"` **Connecting to the engine for CLI and trust settings…**
- With a client, `SettingsTrustSections`:

| Query (topics `[]`)          | Result                                                |
| ---------------------------- | ----------------------------------------------------- |
| `settings/cli_status {}`     | `{ clis: CliInfo[] }` (`{ id, installed, version? }`) |
| `settings/get_trust {}`      | `{ alwaysTrusted, homeRealpath }`                     |
| `settings/list_mcp_trust {}` | `{ servers: McpTrustEntry[] }` (`{ key, trustedAt }`) |

Mutations keep local overrides (`trustOverride`, `mcpOverride`) because these queries have no topics.

Layout `FieldGroup className="gap-6"`:

1. `PageSection "Agent CLIs"`: `FieldDescription` **Read-only. The app never writes CLI settings files.**; loading `Skeleton h-20 w-full`; else `ItemGroup data-testid="cli-status-list"` of `Item variant="outline" data-testid="cli-<id>"`: mono title id; description version, **installed**, or **Not found on PATH**; action `Badge` `secondary` **installed** / `outline` **missing**.
2. `PageSection "Always-trust"`: `Item variant="outline" data-testid="trust-settings"`, title **Agent CLI trust for this app home**, description **Loading…** / **Trusted (<homeRealpath>)** / **Not always trusted. You will be asked before agent runs.**; action `Button size="sm" variant="outline"`: when trusted `trust-revoke` **Revoke** (`settings/set_trust {grant: "none"}`), else (once loaded) `trust-always` **Trust always** (`{grant: "always"}`). Toasts: success **Always-trust enabled** / **Always-trust revoked**; error **Could not enable always-trust** / **Could not revoke always-trust**. Result `{ alwaysTrusted, homeRealpath }` stored as override.
3. `SettingsMcpSection`.

### SettingsMcpSection

Props `servers: McpTrustEntry[] | null, revokingKey, onRevoke(key)`.
`PageSection "Allowed MCP servers"`: `FieldDescription` **Local MCP servers (command or URL) run only after you allow them. Revoke here to require allow again.**; null → `Skeleton h-20 w-full`; empty → `p.text-sm.text-muted-foreground data-testid="mcp-trust-empty"` **No MCP servers allowed yet.**; else `ItemGroup data-testid="mcp-trust-list"` of `Item variant="outline" data-testid="mcp-trust-row"`: title mono `break-all` key; description **Allowed <RelativeTime trustedAt>**; action `Button size="sm" variant="outline" data-testid="mcp-trust-revoke"` **Revoke** (disabled while revoking that key).
Revoke: `settings/set_mcp_trust { key, grant: "none" }` → `{ servers }` stored as override; toast **MCP allow revoked** / error **Could not revoke MCP allow**.
