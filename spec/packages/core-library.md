# core: library (items, versions, providers, pull/push jobs, FCP)

Part of the [`@workspace/core` spec](core.md). Covers `src/library/`.

A library item is a folder `library/<id>/` with `item.yaml` (contracts
`LibItemDisk`: `id, kind: ProviderIcon, title, source, remoteId?, remoteUrl?,
tags, current`) and immutable version folders `library/<id>/v<n>/` holding a
`.version.yaml` meta (`{n, at, note, contentHash}`) plus the files. The wire
`LibItem` is the disk record plus `versions: LibVersion[]` (newest first).
`source` is `"local"` or a provider id. Providers are
`providers/<id>.yaml` (contracts `ProviderDescriptor`; `detect(url,
providers)` matches links).

## Files

| File           | Purpose                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `index.ts`     | barrel                                                                 |
| `versions.ts`  | paths, content hash, item/version disk helpers, `nextCurrent`          |
| `service.ts`   | `LibraryService` (list/get/pin/tags/add/unlink/remove/pull/push)       |
| `mutations.ts` | `addRemoteItem`, `addLocalItem`, `unlinkItem`                          |
| `jobs.ts`      | `runPullJob`, `runPushJob` (async jobs with `library/update` progress) |
| `fetch.ts`     | `LibraryFetcher`, `createConnectorLibraryFetcher`                      |
| `providers.ts` | `ProviderService` (preset seeding, list, save, match)                  |
| `users.ts`     | `cardUsersOfItem` (busy check)                                         |
| `bind.ts`      | FCP bindings for `library/*`                                           |

`library/index.ts` exports: `createLibraryBindings`,
`createLibraryItemBindings`, `createLibraryProviderBindings`, the three
binding types, `createConnectorLibraryFetcher`, `LibraryFetchResult`,
`LibraryFetcher`, `LibraryPushResult`, `PROVIDERS_GLOB`,
`createProviderService`, `providerIdFromPath`, `providerPath`,
`ProviderService`, `ProviderServiceDeps`, `createLibraryService`,
`LibraryService`, `LibraryServiceDeps`, `cardUsersOfItem`, `ITEM_YAML`,
`VERSION_META`, `contentHashOf`, `itemDir`, `itemYamlPath`, `listItemIds`,
`listVersionMetas`, `newestVersionN`, `nextCurrent`, `readItemDisk`,
`readVersionFiles`, `removeItemTree`, `toDisk`, `toLibItem`, `versionDir`,
`versionFilePath`, `versionMetaPath`, `writeItemDisk`, `writeVersion`. The
package root re-exports all of these **except** `cardUsersOfItem`,
`readVersionFiles`, `removeItemTree`, `toDisk`.

## Disk helpers (`versions.ts`)

```ts
const ITEM_YAML = "item.yaml"; const VERSION_META = ".version.yaml"
itemDir(id) → `library/${id}`;  itemYamlPath(id) → `library/${id}/item.yaml`
versionDir(id, n) → `library/${id}/v${n}`;  versionMetaPath(id, n) → `.../v${n}/.version.yaml`
versionFilePath(id, n, rel) → `.../v${n}/${rel without leading /}`
contentHashOf(files): string
readItemDisk(docs, id): LibItemDisk | null
listVersionMetas(docs, id): LibVersionMeta[]      // newest first
toLibItem(disk, versions): LibItem
newestVersionN(metas): number                     // 0 when none
nextCurrent(prevCurrent, prevNewest, newN): number
writeItemDisk(docs, item); toDisk(item: LibItem): LibItemDisk
removeItemTree(docs, id); writeVersion(docs, id, meta, files)
readVersionFiles(docs, id, n): Record<string, string>
listItemIds(docs): string[]
```

- `contentHashOf(files)`: keys sorted (`localeCompare`), body =
  concatenation of `${key}\0${value}\n`, `hashUtf8Text(body)`.
- `readItemDisk`: missing, unparsable (`safeParseLibItemYaml`) or id
  mismatch → `null`.
- `listVersionMetas`: list `library/<id>/v*/.version.yaml`, match
  `^/?library/([^/]+)/v(\d+)/(.*)$` with the same id, parse
  (`parseLibVersionMetaYaml`); keep only metas whose `n` equals the folder
  number; broken metas skipped; sort by `n` descending.
- `nextCurrent`: first version (`prevNewest === 0`) → `newN`; tracking newest
  (`prevCurrent === prevNewest`) → `newN`; pinned older → unchanged.
- `toDisk`: drops `versions`; copies `remoteId`/`remoteUrl` only when defined.
- `removeItemTree`: remove every path under `library/<id>/**`, then
  `item.yaml` explicitly.
- `writeVersion`: meta YAML then each file.
- `readVersionFiles`: files under `v<n>/` excluding `.version.yaml`, skipping
  rels containing `..`.
- `listItemIds`: from `library/*/item.yaml`, sorted.

## LibraryService (`service.ts`, `mutations.ts`, `users.ts`)

```ts
type LibraryServiceDeps = {
  docs
  bus: UpdateBus
  ids: Ids
  clock: Clock
  fetcher: LibraryFetcher
}
class LibraryService {
  list(tag?: string): LibItem[]
  get(id): LibItem | null
  pinVersion(id, n): LibItem
  setTags(id, tags): LibItem
  addRemote({ id, kind, title, source, remoteId, remoteUrl, tags }): LibItem
  addLocal({ id, kind, title, tags, files }): LibItem
  unlink(id): LibItem
  remove(id): void
  pull(id, signal): { jobId }
  push(id, signal): { jobId }
  flush(): Promise<void> // await all running jobs (tests)
}
createLibraryService(deps)
```

Notifications on `library/update`: `item_changed {item}`, `item_removed
{id}`, `job_progress {jobId, itemId, message, fraction}`, `job_finished
{jobId, itemId, ok: true, unchanged, version}` or `{jobId, itemId, ok:
false, error}`.

| Operation       | Behaviour                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list(tag?)`    | all ids → `get`, filter by `tags.includes(tag)`                                                                                                                                       |
| `get`           | disk record + versions (`n, at, note, contentHash`)                                                                                                                                   |
| `pinVersion`    | missing item → `not_found "Library item not found: <id>"`; unknown n → `not_found "Version not found: v<n>"`; write `current = n`; publish `item_changed`; return item                |
| `setTags`       | require item; write tags (copy); publish                                                                                                                                              |
| `addRemote`     | `LibItemId.parse(id)`; exists → `conflict "Library item already exists: <id>"`; write `{..., current: 1}` with **no version** (client then pulls); publish                            |
| `addLocal`      | exists → conflict; files default `{"README.md": ""}` when empty; write item `{source: "local", current: 1}` and v1 `{n: 1, at: now, note: "Added from disk", contentHash}`; publish   |
| `unlink`        | missing → `not_found`; `source === "local"` → `unsupported "Item is not linked to a remote"`; rewrite as `source: "local"` dropping `remoteId`/`remoteUrl`, keeping versions; publish |
| `remove`        | require; `cardUsersOfItem` non-empty → `busy "Library item is used by cards: a, b"` with `data {users}`; else remove tree, publish `item_removed {id}`                                |
| `pull` / `push` | require item; `jobId = ids.id("job")`; start the job in the background (tracked in `pending`), return `{jobId}` immediately                                                           |

`cardUsersOfItem(docs, itemId)`: card ids (sorted) under
`docket/cards/*/card.md` whose tolerant-parsed frontmatter `refs` contain
`{system: "library", id: itemId}`.

### Jobs (`jobs.ts`)

Pull:

1. Publish `job_progress {message: "Fetching", fraction: 0.1}`.
2. Read disk (missing → failure). `fetched = fetcher.fetch(disk, signal)`;
   `hash = contentHashOf(fetched.files)`.
3. If the newest version's `contentHash === hash` → publish `job_finished
{ok: true, unchanged: true, version: newest}`; no new version.
4. Else `n = newest + 1`, meta `{n, at: now, note: fetched.note ?? (newest
=== 0 ? "First fetch" : "Updated"), contentHash}`; `writeVersion`; write
   item with `current = nextCurrent(...)`; publish `item_changed` then
   `job_finished {ok: true, unchanged: false, version}`.

Push: progress `"Pushing"` 0.1; files = `readVersionFiles(current)`;
`pushed = fetcher.push(disk, files, signal)`; always records a new version
`n = newest + 1` with `note = pushed.note ?? "Pushed local changes to the
remote"` and the same files; `current` via `nextCurrent`; publish as above.

Any thrown error → `job_finished {ok: false, error: err.message ?? "Pull
failed" | "Push failed"}` (never rejects).

### Connector fetcher (`fetch.ts`)

```ts
type LibraryFetchResult = { files: Readonly<Record<string, string>>; note?: string }
type LibraryPushResult = { note?: string }
type LibraryFetcher = { fetch(item, signal): Promise<LibraryFetchResult>; push(item, files, signal): Promise<LibraryPushResult> }
createConnectorLibraryFetcher({ connectors, runtime, providers }): LibraryFetcher
```

Capability resolution: `source === "local"` or no `remoteId` →
`unsupported "Item has no remote to pull"` / `"... to push"`; connector =
first in `connectors.list()` (sorted by id) whose `providerId === source`
(none → `not_found "No connector for provider: <source>"`); record missing →
`not_found "Connector not found: <id>"`; capability = first whose
`Boolean(write)` equals the direction and that is allowed (none →
`policy_denied "No read|write capability on connector: <id>"`).

- fetch: `runtime.call(id, cap, [remoteId])`; non-zero exit → `internal
<trimmed stderr || "Fetch failed (exit <n>)">`. Stdout starting with `{`
  that parses with an object `files` → `{files, note?}`; otherwise `{files:
{<provider.layout[0] ?? "content.txt">: stdout}, note: "Pulled"}`.
- push: `runtime.call(id, cap, [remoteId, JSON.stringify({files})])`;
  non-zero → `internal <stderr || "Push failed (exit <n>)">`. Note: plain
  stdout trimmed (if non-empty), or JSON `note` string; returns `{note}` or
  `{}`.

## Providers (`providers.ts`)

```ts
const PROVIDERS_GLOB = "providers/*.yaml"
providerPath(id) → `providers/${id}.yaml`; providerIdFromPath(path) → id | null (optional leading /)
type ProviderServiceDeps = { docs; presets?: readonly ProviderDescriptor[] }
class ProviderService { list(); save(provider); match(url): ProviderMatch | null }
createProviderService(deps)
```

Constructor: presets = contracts `DEFAULT_PROVIDERS` (GitHub, Confluence,
Rally) plus extra presets whose ids are not defaults; writes each preset's
YAML when its file does not exist yet (never overwrites user edits).
`list()`: parse every provider file (invalid or id-mismatched files
skipped), sorted by id. `save`: write YAML without lock; a failed write →
`conflict "Could not save provider"`. `match(url)` = `detect(url, list())`.

## FCP bindings (`bind.ts`)

`createLibraryProviderBindings(providers)`,
`createLibraryItemBindings(library, providers)`, and
`createLibraryBindings(providers, library)` (both merged). Paging for list
methods: by `id` cursor (unknown cursor → empty page), `limit` default all,
`next` = last id when more remain.

| Method                                                        | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `library/list_providers`                                      | paged `providers.list()`                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `library/save_provider`                                       | `providers.save(provider)`; `{}` (schema rejects invalid patterns and patterns without a named group `id` as `invalid_params`)                                                                                                                                                                                                                                                                                                                         |
| `library/list`                                                | paged `library.list(tag)`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `library/get`                                                 | `not_found "Library item not found: <id>"` or the item                                                                                                                                                                                                                                                                                                                                                                                                 |
| `library/pull` / `library/push`                               | `{jobId}` (uses `ctx.signal`)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `library/add`                                                 | `kind: "remote"`: `detect(url, providers)`; no match → `invalid_params "No provider matches this link. Add its provider under Providers."`; id = unique slug of `<providerId>-<matchId>`; `addRemote({kind: provider.icon, title: match.title, source: provider.id, remoteId: match.id, remoteUrl: match.url, tags: tagsOf(match)})`. Otherwise local: id = unique slug of `title`; `addLocal({kind: itemKind, title, tags, files})`. Returns the item |
| `library/unlink` / `library/pin_version` / `library/set_tags` | service calls, return the item (tags must be `namespace:value` per schema)                                                                                                                                                                                                                                                                                                                                                                             |
| `library/remove`                                              | `library.remove(id)`; `{}`                                                                                                                                                                                                                                                                                                                                                                                                                             |

Slug: lowercase, runs of non `[a-z0-9]` → `-`, trim dashes, empty →
`item`, then `LibItemId.parse`. Unique: base if free, else `base-2` ..
`base-999`; exhausted → `conflict "Library item id exhausted: <base>"`.
