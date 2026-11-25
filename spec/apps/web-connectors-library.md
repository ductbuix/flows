# apps/web — Connectors (`/connectors`) and Library (`/library`)

Part of the [web spec](web.md). Files: `src/pages/connectors/*` (12 source
files) and `src/pages/library/*` (19 source files).

# Connectors

## File map

| File                      | Exports                                                                                                                                    | Role                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `ConnectorsPage.tsx`      | `ConnectorsPage`                                                                                                                           | Route; gate, remount-on-mutate wrapper, list page |
| `ConnectorsStates.tsx`    | `ConnectorsLoading`, `ConnectorsLoadError`, `ConnectorsEmpty`                                                                              | States                                            |
| `ConnectorsTable.tsx`     | `ConnectorsTable`                                                                                                                          | Table                                             |
| `AddConnectorDialog.tsx`  | `AddConnectorDialog`                                                                                                                       | Create a connector                                |
| `ConnectorSheet.tsx`      | `ConnectorSheet`                                                                                                                           | Right Sheet wrapper                               |
| `ConnectorSheetBody.tsx`  | `ConnectorSheetBody`                                                                                                                       | Header, status card, tabs                         |
| `ConnectorStatusCard.tsx` | `ConnectorStatusCard`                                                                                                                      | Status + primary action                           |
| `ConnectorSheetTabs.tsx`  | `ConnectorAccessTab`                                                                                                                       | Capability switches                               |
| `ConnectorUsedByTab.tsx`  | `ConnectorUsedByTab`                                                                                                                       | Library usage                                     |
| `ConnectorSetupTab.tsx`   | `ConnectorSetupTab`                                                                                                                        | Edit name/how, disconnect, remove                 |
| `connector-actions.ts`    | result types, `saveConnector`, `removeConnector`, `setCapability`, `checkConnector`, `signInConnector`, `signOutConnector`, `slugFromName` | FCP helpers                                       |
| `connector-labels.ts`     | `TRANSPORT`, `AUTH`, `AUTH_FOR` (re-export), `authLabel`                                                                                   | Copy tables                                       |
| `connector-parts.tsx`     | `TransportBadge`, `StatusBadge`, `SIGN_IN`, `accessOf`                                                                                     | Small parts                                       |

## FCP calls

| Method                                      | Params → result                                                                   | Where                            |
| ------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------- |
| `connector/list` (query, topic `connector`) | `{}` → `{ items: ConnectorSummary[] }` (`id, name, how, transport, auth, status`) | page                             |
| `connector/get` (query, topic `connector`)  | `{ id }` → `{ connector: ConnectorFile, hash, status, checkedAt? }`               | sheet                            |
| `library/list` (query, topic `library`)     | `{}`                                                                              | sheet (Used by count), UsedByTab |
| `connector/save`                            | `{ connector, baseHash? }` → `{ hash }`                                           | add, setup save                  |
| `connector/remove`                          | `{ id }`                                                                          | setup                            |
| `connector/set_capability`                  | `{ id, name, allowed, baseHash }` → `{ hash }`                                    | access tab                       |
| `connector/check`                           | `{ id }` → `{ status, detail? }`                                                  | status card                      |
| `connector/sign_in`                         | `{ id }` → `{ cancelled: true }` or signed in                                     | status card (cookies)            |
| `connector/sign_out`                        | `{ id }`                                                                          | setup Disconnect                 |

`ConnectorFile`: `{ id, name, transport: "mcp"|"api"|"cli", how, auth: "cookies"|"pat"|"oauth"|"cli-login"|"none", capabilities: {name, desc, write, allowed}[], providerId? }`.

### connector-actions.ts

```ts
export type ConnectorActionResult =
  | { ok: true; hash?: string }
  | { ok: false; kind: "conflict" }
  | { ok: false; kind: "error"; message: string }
export type ConnectorCheckActionResult =
  | { ok: true; status: ConnectorStatus; detail?: string }
  | { ok: false; kind: "error"; message: string }
export type ConnectorSignInActionResult =
  | { ok: true; signedIn: true }
  | { ok: true; cancelled: true }
  | { ok: false; kind: "error"; message: string }
export function slugFromName(name: string, fallback: string): string // lowercase, non-alnum → "-", trim one dash each end, else fallback
```

`check` and `sign_in` never report conflict.

### Labels

| Transport | label      | hint                                       | field label    | example (placeholder)                        | icon       |
| --------- | ---------- | ------------------------------------------ | -------------- | -------------------------------------------- | ---------- |
| `mcp`     | MCP server | A local command or a standard MCP endpoint | Command or URL | `npx -y @modelcontextprotocol/server-github` | `Server`   |
| `api`     | API        | A REST or GraphQL interface                | Base URL       | `https://wiki.company.com/rest/api`          | `Cable`    |
| `cli`     | CLI        | A command already installed and signed in  | Binary         | `gh`                                         | `Terminal` |

| Auth        | label           | hint                                                   | `SIGN_IN` action     |
| ----------- | --------------- | ------------------------------------------------------ | -------------------- |
| `cookies`   | Browser cookies | Sign in once in a window; cookies stay on this machine | Sign in with browser |
| `pat`       | Access token    | A personal access token kept in the keychain           | Enter token          |
| `oauth`     | OAuth           | Approve in the browser                                 | Authorize            |
| `cli-login` | CLI login       | Uses the CLI's own saved sign-in                       | Check CLI login      |
| `none`      | No sign-in      | Open endpoint                                          | Check                |

`AUTH_FOR` (from contracts): mcp → oauth, pat, none; api → cookies, pat, oauth; cli → cli-login, pat. First entry is the default.

`StatusBadge` → `StatusPill data-testid="connector-status"`: connected → done **Connected**; expired → attention **Sign-in expired**; off → idle **Not connected**.
`TransportBadge` → `Badge outline` icon + label. `accessOf(c)` → **Read and write** if any capability writes and is allowed else **Read only** (exported, unused by screens).

## ConnectorsPage

- Gate pattern; then `ConnectorsPageGate` holds `epoch` and `pendingOpen` (initial URL param `connector`). Inner page is keyed by `epoch`; `onMutated(openId)` sets `pendingOpen` and bumps `epoch` (forces a full refetch after add/remove; after add the new connector's sheet opens).
- Inner: query `connector/list`; state `openId` (init `initialOpenId`), `adding`, `conflict`, `actionError`.
- Loading → `ConnectorsLoading`; error w/o data → `ConnectorsLoadError`.
- `<Page crumbs=[{label:"Connectors"}] data-testid="connectors-page">`:
  - Header action Button `connector-add-open` (`Plus`) **Add connector**.
  - `PageTitle title="Connectors" description="How agents and scripts reach outside systems."`
  - Alert `connectors-conflict`: **Conflict** / **This connector changed on disk. Close the sheet and try again.** or **Could not update** / message.
  - Empty → `ConnectorsEmpty`; else `ConnectorsTable` (picking clears errors and opens the sheet).
  - `ConnectorSheet`, `AddConnectorDialog`.

### States

- `ConnectorsLoading` (`Page fill`): description **Loading connectors…**; `div.flex.flex-col.gap-3 data-testid="connectors-loading"` with `Skeleton h-10 w-48` + `h-80 w-full`.
- `ConnectorsLoadError` (`Page fill`): **Could not load connectors.** + Alert `connectors-error`.
- `ConnectorsEmpty`: `Empty data-testid="connectors-empty"` (no ring), icon `Cable`, **No connectors yet** / **Add a connector so agents and scripts can reach an outside system.**

### ConnectorsTable

`Table data-testid="connector-table"`; columns **Name** | **Connects via** | **Sign-in** | **Status**. Row `cursor-pointer data-testid="connector-row-<id>"`: name (`font-medium`) over mono `max-w-64 truncate text-xs text-muted-foreground` `how`; `TransportBadge`; muted `authLabel`; `StatusBadge`.

### AddConnectorDialog

Props `open, onOpenChange, onAdded(id), onConflict, onError`. State transport (default `api`), auth (default `cookies`), name, how, busy.
`DialogContent sm:max-w-md data-testid="connector-add"`; title **Add connector**; description **Pick how it connects, then how it signs in.**

- **Connects via**: `ToggleGroup variant="outline"` single value of MCP server / API / CLI (`connector-transport-<k>`); changing transport resets auth to `AUTH_FOR[t][0]`. `FieldDescription` = transport hint.
- **Name**: `Input#cn-name` placeholder **Wiki**, `connector-add-name`.
- `<transport field label>`: `Input#cn-how` placeholder = transport example, `connector-add-how`.
- **Sign-in**: `Select` of allowed auths; `FieldDescription` = `<auth hint>.`
- Footer: outline **Cancel**; `connector-add-submit` **Add** (disabled while busy or name/how empty).
- Submit: id = `slugFromName(name, "connector-<Date.now()>")`; `saveConnector` with `capabilities: [{ name: "read", desc: "Read data (discovered on first connect)", write: false, allowed: true }]` and no baseHash. Error → page alert; ok → `onAdded(id)` and close (reset name/how).

## ConnectorSheet / ConnectorSheetBody

`Sheet open={!!openId}`; `SheetContent className="data-[side=right]:sm:max-w-lg" data-testid="connector-sheet"`.

Body (`id`): queries `connector/get {id}`, `library/list {}`. Local `patch: {hash, connector} | null` overrides remote after own edits; `busy`.

- `c = patch?.connector ?? remote.connector`; `hash = patch?.hash ?? remote.hash ?? ""`; `status = remote.status ?? "off"`; `libCount` = library items whose `source === c.providerId`.
- Loading: `div.flex.flex-col.gap-2.px-4.pt-4 data-testid="connector-sheet-loading"` (`Skeleton h-10 w-full`, `h-40 w-full`).
- Error: Alert destructive `mx-4 mt-4 data-testid="connector-sheet-error"` **Could not load connector**.
- `SheetHeader pr-12`: title `c.name` + `TransportBadge`; description = transport hint.
- `ConnectorStatusCard` with `onAction`: if auth is `cookies` and not connected → `signInConnector` (desktop host opens a sign-in window; cancel is silent); else `checkConnector`. Errors → page alert.
- `Tabs defaultValue="access" className="min-h-0 flex-1 px-4 pt-1"`: **Access (<n caps>)**, **Used by (<libCount>)** (`connector-tab-used`), **Setup**.
  - access content `flex flex-col gap-1 overflow-y-auto py-3` → `ConnectorAccessTab`; toggle → `setCapability({id, name, allowed, baseHash: hash})`; ok updates `patch` locally.
  - used content `flex flex-col gap-4 overflow-y-auto py-3` → `ConnectorUsedByTab providerId`.
  - setup content `flex flex-col gap-3 overflow-y-auto py-3` → `ConnectorSetupTab key="<id>:<hash>"`; save updates `patch`.

### ConnectorStatusCard

`div.mx-4.flex.flex-col.gap-2.rounded-2xl.bg-muted/50.p-3.ring-1.ring-foreground/10`: row with `StatusBadge`, muted truncated **checked <formatRelative(checkedAt)>** or **checked never**, and Button `connector-action` (outline when connected, else default): busy → `Spinner` + **Working…**; connected → **Test**; else `SIGN_IN[auth]`. When expired: xs muted **Cookies expire on their own. Steps that use this connector wait for a sign-in instead of failing.**

### ConnectorAccessTab

Intro `p.pb-2.text-sm.text-muted-foreground` **What agents and scripts may do here. Writing is off until you allow it.** Each capability row `flex min-h-12 items-center gap-3 rounded-lg px-2 hover:bg-muted data-testid="capability-<name>"`: mono name + `Badge secondary` **Writes** when `write`, xs muted truncated `desc`; `Switch aria-label="Allow <name>"` (disabled while busy).

### ConnectorUsedByTab

`div[data-testid="connector-used-by"]`. None → muted **Nothing uses this yet. Add it to an agent or script step in a workflow.** Else a `Link` to `/library` (`connector-used-library`, `-mx-2 flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted`) with `Library` icon, **Library fetches**, xs muted **N linked item(s)**.

### ConnectorSetupTab

Fields (`flex flex-col gap-3`): **Name** `Input#cn-edit-name-<id>` (`connector-edit-name`); `<transport field>` `Input#cn-edit-how-<id>` (`connector-edit-how`); read-only row **Sign-in** = auth label (`flex min-h-9 items-center justify-between gap-4 text-sm`). Then xs muted `<auth hint>.`
Buttons (`flex flex-wrap gap-2`): **Save** (`connector-save`, enabled when dirty and both non-empty) → `saveConnector(next, hash)`; outline **Disconnect** (`connector-disconnect`, disabled when status `off`) → `signOutConnector`; outline **Remove** (`connector-remove`) → ConfirmDialog **Remove connector?** / **Steps and Library items that use it will wait for a connector. Saved sign-ins on this machine are deleted.** / **Remove** → `removeConnector` → `onRemoved` (page remounts, sheet closes).

# Library

## File map

| File                       | Exports                                                                                                                          | Role                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `LibraryPage.tsx`          | `LibraryPage`                                                                                                                    | Route                                    |
| `LibraryStates.tsx`        | `LibraryLoading`, `LibraryLoadError`, `LibraryEmpty`, `LibraryProvidersEmpty`                                                    | States                                   |
| `LibraryChrome.tsx`        | `LibraryChrome`                                                                                                                  | Search, source tabs, list/gallery toggle |
| `LibraryBody.tsx`          | `LibraryBody`                                                                                                                    | Tag rail + active tags + view            |
| `LibraryViews.tsx`         | `typeLabel`, `LibraryTable`, `LibraryGallery`                                                                                    | List and gallery                         |
| `LibraryKind.tsx`          | `KIND_SINGULAR`, `KindIcon`                                                                                                      | Icon/label per `ProviderIcon`            |
| `LibraryTags.tsx`          | `TagBadge`, `TagRail`, `TagEditor`                                                                                               | Tags                                     |
| `LibraryConflictAlert.tsx` | `LibraryConflictAlert`                                                                                                           | Page alert                               |
| `LibrarySheet.tsx`         | `LibrarySheet`                                                                                                                   | Item detail Sheet                        |
| `LibraryRemote.tsx`        | `LibraryRemote`                                                                                                                  | Link status, Fetch, menu                 |
| `LibraryFiles.tsx`         | `LibraryFiles`                                                                                                                   | Files of the current version             |
| `LibraryVersions.tsx`      | `LibraryVersions`                                                                                                                | Version list + pin                       |
| `AddLibraryDialog.tsx`     | `AddLibraryDialog`                                                                                                               | Add by link or from disk                 |
| `ProviderDetect.tsx`       | `findExisting`, `matchLink`, `LinkInput`, `DetectCard`                                                                           | Link detection preview                   |
| `ProvidersDialog.tsx`      | `accessLabel`, `ProvidersDialog`                                                                                                 | Provider list + add                      |
| `ProviderForm.tsx`         | `ProviderForm`                                                                                                                   | Custom provider                          |
| `library-filter.ts`        | `KindFilter`, `filterItems`, `countBySource`, `sourceTabs`, `splitTag`                                                           | Filtering                                |
| `library-actions.ts`       | `LibraryActionResult`, `pinVersion`, `pullItem`, `pushItem`, `unlinkItem`, `setTags`, `addFromLink`, `addFromDisk`, `removeItem` | FCP helpers                              |
| `provider-actions.ts`      | `ProviderActionResult`, `saveProvider`, `upsertProvider`                                                                         | Provider helpers                         |

## FCP calls

All item ids are passed through `LibItemId.parse(id)`; mutations carry `requestKey: crypto.randomUUID()`.

| Method                                        | Params → result                                                                                                                                     | Where                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `library/list_providers` (query, topics `[]`) | `{}` → `{ items: ProviderDescriptor[] }`                                                                                                            | page                                 |
| `library/list` (query, topic `library`)       | `{}` → `{ items: LibItem[] }`                                                                                                                       | page                                 |
| `library/get` (query, topic `library`)        | `{ id }` → `LibItem`                                                                                                                                | sheet                                |
| `library/pin_version`                         | `{ id, n, requestKey }` → `LibItem`                                                                                                                 | versions                             |
| `library/pull` / `library/push`               | `{ id, requestKey }` → `{ jobId }`                                                                                                                  | remote                               |
| notification `library/update`                 | `{ kind: "job_finished", jobId, ok, error? }`                                                                                                       | remote (via `client.onNotification`) |
| `library/unlink`                              | `{ id, requestKey }` → `LibItem`                                                                                                                    | remote                               |
| `library/set_tags`                            | `{ id, tags, requestKey }` → `LibItem`                                                                                                              | details                              |
| `library/add`                                 | remote: `{ kind: "remote", url, requestKey }`; local: `{ kind: "local", title, itemKind, tags, files: Record<path, text>, requestKey }` → `LibItem` | add dialog                           |
| `library/remove`                              | `{ id, requestKey }`                                                                                                                                | page confirm                         |
| `library/save_provider`                       | `{ provider }`                                                                                                                                      | providers dialog                     |
| `file/list` (query, topics `[]`)              | `{ path: "library/<id>/v<current>", limit: 200 }` → `{ items: {path, kind}[] }`                                                                     | files tab                            |

`LibItem`: `{ id, title, kind: ProviderIcon, source: "local" | providerId, remoteId?, remoteUrl?, tags: string[], current: number, versions: {n, at, note}[] }` (newest version first).
`ProviderDescriptor`: `{ id, label, icon, pattern, example, layout: string[], tags: string[], access: "read"|"readwrite", fetch, custom? }`. `DEFAULT_PROVIDERS` and `detect(url, providers) → ProviderMatch {provider, id, url} | null` come from contracts.

### library-actions.ts

```ts
export type LibraryActionResult = "ok" | "conflict" | string
export function pinVersion(
  client,
  id,
  n
): Promise<LibraryActionResult | LibItem>
export function pullItem(
  client,
  id
): Promise<{ ok: true; jobId } | { ok: false; error }>
export function pushItem(
  client,
  id
): Promise<{ ok: true; jobId } | { ok: false; error }>
export function unlinkItem(client, id): Promise<LibraryActionResult | LibItem>
export function setTags(
  client,
  id,
  tags
): Promise<LibraryActionResult | LibItem>
export function addFromLink(
  client,
  url
): Promise<{ ok: true; id; jobId: string | null } | { ok: false; error }> // add then pull; pull failure → jobId null
export function addFromDisk(
  client,
  { title, itemKind, tags, files }
): Promise<{ ok: true; id } | { ok: false; error }>
export function removeItem(client, id): Promise<LibraryActionResult>
```

### library-filter.ts

- `filterItems(items, kind, search, tags = [])`: `kind !== "all"` → `source === kind`; every selected tag must be present (AND); search (trim, lowercase) matches title, remoteId, or any tag substring.
- `countBySource(items, source)`: all → length, else count by source.
- `sourceTabs(items, providers)`: distinct non-local sources in item order, label = provider label or `<id> (removed)`; plus `{ id: "local", label: "Local files" }` when any local item.
- `splitTag(tag)` → `[namespace, value]`; no colon (or leading colon) → `["", tag]`.

### provider-actions.ts

`saveProvider(client, provider)` → `"ok" | "conflict" | message`. `upsertProvider(list, p)` replaces by id and sorts by id.

## LibraryPage

- Gate pattern. Queries `library/list_providers {}` (topics `[]`, so no live refresh) and `library/list {}` (topic `library`).
- State: `saved: ProviderDescriptor[]` (providers saved this session, merged over the query via `upsertProvider`), `kind: KindFilter` ("all"), `search`, `tags: string[]`, `gallery` (false), `providersOpen`, `adding`, `openId` (init URL param `item`), `deletingId`, `busy`, `conflict`, `actionError`.
- `inKind = filterItems(items, kind, "")` (feeds the tag rail); `shown = filterItems(items, kind, search, tags)`.
- Loading → `LibraryLoading`; error → `LibraryLoadError`.
- `<Page crumbs=[{label:"Library"}] data-testid="library-page">`:
  - Header actions: outline `library-providers-open` (`Plug`) **Providers**; `library-add-open` (`Plus`) **Add to Library**.
  - `PageTitle title="Library" description="Local copies of the repositories, pages and tickets tasks refer to. Each item is a local folder. Linked items are fetched from their remote, one version per fetch."`
  - `LibraryConflictAlert` (`data-testid="library-conflict"`): **Conflict** / **A provider changed on disk. Close Providers and try again.** or **Could not save** / message.
  - `LibraryChrome`; empty items → `LibraryEmpty`; else `LibraryBody`.
  - `LibrarySheet itemId=openId`; `AddLibraryDialog` (added/existing → open sheet); `ProvidersDialog` (save → `saveProvider`; conflict → flag; ok → add to `saved`).
  - ConfirmDialog **Remove from Library?** / **The local copy and all its versions are deleted. Cards that point at it will show it as missing. The remote is untouched.** / **Remove** (pending = busy) → `removeItem`; conflict → error **Conflict removing item**; ok closes confirm and sheet.

### States

- `LibraryLoading`: description **Loading providers…**; `div[data-testid="library-loading"]` `Skeleton h-10 w-64` + `h-80 w-full`.
- `LibraryLoadError`: **Could not load providers.**; Alert `library-error`.
- `LibraryEmpty`: `Empty ring-1 ring-foreground/10 data-testid="library-empty"`, icon `Library`, **No library items yet** / **Add a repository, page or ticket so tasks have a local copy to read.**
- `LibraryProvidersEmpty`: `Empty data-testid="library-providers-empty"`, **No providers** / **Add a preset or a custom provider so links can be recognised.**

### LibraryChrome

`div.flex.flex-wrap.items-center.gap-3`:

- Search `InputGroup className="max-w-sm min-w-48 flex-1"`, placeholder **Search name, id or tag**, `library-search`.
- `Tabs value=kind` → `TabsList`: **All (<n>)**; one trigger per `sourceTabs` entry `<label> (<count>)` (`library-kind-<id>`); then remaining providers with no items `<label> (0)`.
- `ButtonGroup className="ml-auto"`: icon Buttons **List view** (`library-view-list`, `List`) and **Gallery view** (`library-view-gallery`, `LayoutGrid`); active one `secondary`, other `outline`.

### LibraryBody

`grid grid-cols-1 gap-6 md:grid-cols-6`: `aside.md:col-span-1` with `TagRail(items=inKind)`; main `flex min-w-0 flex-col gap-4 md:col-span-5`:

- Active tags row (`library-active-tags`): muted **Tagged**, active `TagBadge`s (click removes), ghost **Clear** (`X`).
- No match: `Empty ring-1 data-testid="library-no-match"`, icon `Search`, **Nothing matches** / **Change the search, type or tags.**
- Else `LibraryGallery` or `LibraryTable`.

### LibraryViews

- `typeLabel(item, providers)`: local → `KIND_SINGULAR[kind]`; else provider label or source id.
- Sync cell: local → `Badge outline` (`Unlink`) **Not linked**; linked → `Badge secondary` (`Link2`) `v<current>` (+ muted date `YYYY-MM-DD` of the current version in gallery).
- `LibraryTable` (`library-table`): columns **Name** | **Tags** | **Version**. Row `library-row-<id>`: `KindIcon` muted + title (`truncate font-medium`) over xs muted `typeLabel` + ` · <mono remoteId>`; tags cell (click stops propagation) shows first tag as clickable `TagBadge` + `+N`; sync cell.
- `LibraryGallery` (`library-gallery`, `grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3`): tile `div role=button` `library-tile-<id>` (`flex cursor-pointer flex-col gap-3 rounded-3xl bg-card p-3 text-left ring-1 ring-foreground/10 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring`, Enter/Space opens): preview `flex h-24 items-center justify-center rounded-2xl bg-muted text-muted-foreground` with `KindIcon size-8`; title + xs muted `<type> · N version(s)`; up to 3 tags + `+N`; sync cell with date.

### LibraryKind

| ProviderIcon | Icon         | Singular        |
| ------------ | ------------ | --------------- |
| repo         | `GitBranch`  | Repository      |
| confluence   | `BookOpen`   | Confluence page |
| rally        | `ListChecks` | Rally item      |
| ci           | `Hammer`     | Build           |
| logs         | `ScrollText` | Log query       |
| web          | `Globe`      | Web page        |
| image        | `Image`      | Image           |
| html         | `FileCode`   | HTML file       |
| other        | `File`       | File            |

### LibraryTags

- `TagBadge({tag, active?, onClick?, onRemove?})`: namespace prefix `ns:` muted (or `opacity-70` when active) + value. Clickable → `Badge` (`default` when active else `outline`) rendered as a `<button>`. Else `Badge outline` with optional remove `button aria-label="Remove <tag>"` (`X size-3`).
- `TagRail({items, active, onToggle})`: counts tags; groups sorted tags by namespace (no namespace → `tag`). None → `p[data-testid="library-tag-rail"]` **No tags yet**. Else `nav aria-label="Tags" data-testid="library-tag-rail"`: per group `h3.px-2.text-xs.font-medium.text-muted-foreground` namespace; per tag `button aria-pressed` (`flex min-h-8 items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted aria-pressed:bg-muted aria-pressed:font-medium`) value + xs muted count.
- `TagEditor({tags, onAdd, onRemove})` (`library-tag-editor`): removable badges; form with `Input` placeholder **Add tag, like epic:EP7** (`library-tag-input`) and outline submit **Add** (`Plus`), enabled when draft matches `/^[a-z0-9-]+:[^\s:]+$/i`.

## LibrarySheet

`SheetContent data-[side=right]:sm:max-w-lg data-testid="library-sheet"`. Body queries `library/get {id}`; local `busy`.

- Loading `library-sheet-loading` (`Skeleton h-8 w-48`, `h-24 w-full`); missing → `p.p-4.text-sm.text-muted-foreground` **Item not found**.
- Header (`pr-12`): title `KindIcon` + item title; description `<typeLabel>` + ` · v<current>` (linked) + ` · N version(s)`.
- Remote box `mx-4 rounded-2xl bg-muted/50 p-3 ring-1 ring-foreground/10` → `LibraryRemote`.
- `Tabs defaultValue="files" className="min-h-0 flex-1 px-4 pt-1"`: **Files**, **Details** (`library-tab-details`), **Versions (<n>)** (`library-tab-versions`).
  - Files → `LibraryFiles key="<id>-<current>"`.
  - Details → section `h3.text-sm.font-medium.text-muted-foreground` **Tags** + `TagEditor` (add ignored if duplicate/busy) → `setTags`; conflict → error **Conflict updating tags**.
  - Versions → `LibraryVersions`; pin → `pinVersion`; conflict → **Conflict pinning version**.

### LibraryRemote

Props `item, providers, onDelete, onError`. `provider` = provider of `item.source`; `writable = access === "readwrite"`; `linked = source !== "local"`; `newest = versions[0]`.

- Jobs: `runJob(pullItem|pushItem)` sets busy, stores `jobId`; an effect listens via `client.onNotification("library/update")` for `job_finished` with that job id, then clears busy and reports `error` when `!ok`.
- Menu (ghost icon `library-menu` **More actions**): **Open remote** (link to `remoteUrl`, new tab; linked only), **Push local changes** (`library-push`, `Upload`; linked + writable), **Unlink from remote** (`library-unlink`, `Unlink`; linked; conflict → **Conflict unlinking item**), destructive **Remove from Library** (`library-remove`, `Trash2`) → page confirm.
- Local item: `div[data-testid="library-remote"]` muted **Only on this machine** + menu.
- Linked: row with `Link2` (success) **Linked to <provider label> <mono remoteId>**, Button `library-fetch` (`RefreshCw` / `Spinner` + **Working…**, text **Fetch**; disabled when busy or provider missing), menu. Hint line (xs muted): provider missing → **Its provider was removed. Add it back under Providers to fetch.**; never fetched → **Not fetched yet. Fetch pulls the first version.**; writable → **Last fetched <YYYY-MM-DD>. Fetch pulls down; Push (menu) sends local edits back.**; read-only → **Last fetched <YYYY-MM-DD>. Read-only: nothing is written back.**

### LibraryFiles

`div[data-testid="library-files"]`: mono xs muted `library/<id>/v<current>/`; loading `Skeleton h-24 w-full`; empty **No files in this version**; else list of files (only `kind === "file"`) as rows (`flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted`) with `FolderOpen` icon and mono path relative to the prefix.

### LibraryVersions

`div[data-testid="library-versions"]`: intro muted — local **Not linked to a remote, so there is nothing to fetch.**; linked **Tasks read the current version. Fetch adds a new one; pin an older one to freeze what tasks see.** Empty **No versions yet**. Row `library-version-<n>` (`flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-muted`): `w-8 font-medium tabular-nums` `v<n>`, note over xs muted `at` (`YYYY-MM-DD HH:MM:SS`), then `Badge secondary` **Current** or ghost **Use this** (`library-pin-<n>`).

## AddLibraryDialog

Props `open, onOpenChange, items, providers, onAdded(id), onOpenExisting?(id), onError`.
`DialogContent sm:max-w-md data-testid="library-add"`; title **Add to Library**; description **Each item is stored as its own folder, even if only one file is fetched.**
`Tabs defaultValue="link"`: **From a link** (`library-add-tab-link`), **From disk** (`library-add-tab-disk`).

- Link tab: `LinkInput` (autofocus, placeholder **Paste a link from a provider, like Rally, Confluence or GitHub**, `aria-label="Remote link"`, `library-link-url`), `DetectCard`, footer outline **Cancel** + `library-add-link-submit` **Add and fetch** (disabled without a match, when already present, or busy) → `addFromLink(match.url)`.
- Disk tab: `DiskPickerBoth` (default notes; picking fills Name with the pick label), **Name** `Input#lib-title` placeholder **Brand guidelines**, **Tags** `Input#lib-tags` placeholder **project:auth type:design** (space-separated, only `ns:value` tokens kept), footer **Cancel** + `library-add-submit` **Add** → reads every file as text (`file.text()`, failures → empty), `itemKind` guess: folder → `other`; png/jpg/jpeg/gif/webp/svg → `image`; htm/html → `html`; else `other`; `addFromDisk`.
- Closing resets url/title/tags/pick.

### DetectCard

- Empty url → nothing. No match → muted row with `CircleHelp` **No provider matches this link. Add its provider under Providers.**
- Match → `div.flex.flex-col.gap-2.rounded-2xl.p-3.ring-1.ring-foreground/10 data-testid="library-detected"`: `CircleCheck` (success) + provider label + mono id. Existing item → muted **Already in the Library · Open it** (underlined button). Else muted **Read and write**/**Read-only** ` · fetches into <mono library/<provider>/<id with [^a-z0-9._-] → "__">/>`, a fully expanded `FilesTree` of `provider.layout` paths, and `TagBadge`s of `provider.tags` with `{id}` replaced.

## ProvidersDialog

`DialogContent sm:max-w-xl data-testid="providers-dialog"`; title **Providers**; description **A provider tells the Library how to recognise a link, which files a fetch writes and whether local changes can go back.**

- List `flex max-h-72 flex-col gap-3 overflow-y-auto` (empty → `LibraryProvidersEmpty`): row `provider-<id>` (`flex items-start gap-2 border-b pb-3 text-sm last:border-b-0`): label (`font-medium`), access Badge (`secondary` **Read and write** / `outline` **Read only**), `Badge outline` **Custom** when custom; muted `fetch`; mono xs muted truncated `pattern`.
- Add row (`provider-add-row`): outline `Plus` Buttons for each `DEFAULT_PROVIDERS` entry not yet present (`provider-preset-<id>`, saves as is) and **Custom…** (`provider-add-open`) → `ProviderForm`. Closing hides the form.

### ProviderForm

`div.flex.flex-col.gap-3.rounded-2xl.p-3.ring-1.ring-foreground/10 data-testid="provider-form"`. Fields: **Name** (`#pv-name`, **Grafana**), **Link pattern (needs an id group)** (`#pv-pattern`, mono, placeholder `grafana[^/]*/d/(?<id>[^/]+)`), **Files a fetch writes (comma separated)** (`#pv-files`, `dashboard.json, panels/cpu.csv`), **Command or API call** (`#pv-fetch`, `Grafana API GET /api/dashboards/uid/{id}`), **Access** Select (Read only / Read and write).
**Add provider** (`provider-add-submit`) enabled when name non-empty, pattern compiles and its source contains `(?<id>`, files non-empty. Builds `{ id: slug(label), label, icon: "other", pattern, example: "", layout: files split/trimmed, tags: ["<id>:{id}"], access, fetch: fetch || "Custom command", custom: true }`. Outline **Cancel** (`provider-add-cancel`).
