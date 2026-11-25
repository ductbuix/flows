# core: skills, files, settings

Part of the [`@workspace/core` spec](core.md). Covers `src/skills/`,
`src/files/` and `src/settings/`.

## skills/

Agent skills are `SKILL.md` files (YAML frontmatter `name`, `description`,
optional `from`, then a markdown body) under `.agents/skills/`,
`.claude/skills/` or `.cursor/skills/` in two roots: the workspace and the
user's home. Skill sources are Library items whose version folders contain
`skills/<slug>/SKILL.md`.

### Files

| File          | Purpose                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.ts`    | barrel                                                                                                         |
| `paths.ts`    | `SKILL_DIRS`, `SKILL_GLOBS`, path → dir/slug, skill keys                                                       |
| `parse.ts`    | `parseSkillMd` (tolerant), `formatSkillMd`                                                                     |
| `catalog.ts`  | `SkillCatalog`: merged view over roots, watcher-driven                                                         |
| `read.ts`     | `skill/list`, `skill/get` bindings                                                                             |
| `install.ts`  | `installSkill`, `uninstallSkill`, `skill/install` / `skill/uninstall` bindings, `createFakeSkillSources`       |
| `sources.ts`  | `skills/sources.json`, offers from library items, `skill/list_sources` / `skill/save` bindings, library reader |
| `fixtures.ts` | `writeSkillFixture` (test helper, not exported)                                                                |

`skills/index.ts` exports: `createSkillCatalog`, `SkillCatalog`, `Skill`,
`SkillCatalogDeps`, `SkillDetail`, `SkillFrom`, `SkillRoot`, `SkillSummary`,
`createFakeSkillSources`, `createSkillInstallBindings`, `INSTALL_DIRS`,
`installSkill`, `uninstallSkill`, `SkillInstallBindings`,
`SkillInstallDeps`, `SkillSourceContent`, `SkillSourceReader`,
`formatSkillMd`, `parseSkillMd`, `ParsedSkillMd`, `parseSkillKey`,
`skillDirFromPath`, `skillKey`, `skillSlugFromPath`, `SKILL_DIRS`,
`SKILL_GLOBS`, `SkillDir`, `SkillScope`, `createSkillReadBindings`,
`SkillReadBindings`, `SkillReadDeps`, `createLibrarySkillSourceReader`,
`createSkillSourcesBindings`, `listOffers`, `listOffersAt`, `listSources`,
`readSourceIds`, `saveSources`, `SOURCES_PATH`, `SkillSourcesBindings`,
`SkillSourcesDeps`. The package root re-exports all except `listOffersAt`.

### Paths (`paths.ts`)

```ts
const SKILL_DIRS = [".agents", ".claude", ".cursor"] as const   // precedence order
type SkillDir = (typeof SKILL_DIRS)[number]; type SkillScope = "workspace" | "home"
const SKILL_GLOBS = SKILL_DIRS.map(d => `${d}/skills/**/SKILL.md`)
normSkillPath(path)        // \ → /, strip one leading /
skillDirFromPath(path)     // lowercased ".agents" | ".claude" | ".cursor" | null
skillSlugFromPath(path)    // folder that holds SKILL.md | null
skillKey(scope, slug) → `${scope}/${slug}`
parseSkillKey(key) → { scope, slug } | null   // scope must be workspace|home, slug non-empty
```

Path regex (case-insensitive):
`^\.(agents|claude|cursor)/skills/(?:.+/)?([^/]+)/SKILL\.md$` — nested
folders allowed; the slug is the last folder.

### Parse (`parse.ts`)

`parseSkillMd(text, folderSlug): {name, description, body, from?, problem?}`:

| Case                                       | Result                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| no frontmatter fence (`splitCardMd` fails) | `name = slug`, `description ""`, `body = text`, `problem "SKILL.md has no frontmatter"`                                                             |
| frontmatter YAML error or not a mapping    | `name = slug`, `body`, `problem = error ?? "SKILL.md frontmatter is invalid"`                                                                       |
| `description` missing/blank                | `name` (trimmed or slug), `problem "SKILL.md has no description"`, `from`                                                                           |
| ok                                         | `name` = trimmed string `name` or slug; trimmed `description`; `body`; `from` if it parses with contracts `skillFromSchema` (`{sourceId, version}`) |

`formatSkillMd({name, description, body, from?})`: frontmatter =
`patchYamlMapping("name: _\n", {name, description, from})` trimmed-end,
joined with the body via contracts `joinCardMd`.

### Catalog (`catalog.ts`)

```ts
type SkillFrom = { sourceId: string; version: number }
type SkillSummary = {
  slug
  name
  description
  scope: SkillScope
  dirs: SkillDir[]
  from?: SkillFrom
  problem?: string
}
type SkillDetail = SkillSummary & { body: string }
type Skill = Pick<SkillDetail, "slug" | "name" | "description" | "body"> // used by SessionSpec.skills
type SkillRoot = {
  scope: SkillScope
  docs: DocumentStore
  watcher: FileWatcher
}
type SkillCatalogDeps = { roots: readonly SkillRoot[]; bus: UpdateBus }
class SkillCatalog {
  start()
  dispose()
  rebuild()
  list(): SkillSummary[]
  get(scope, slug): SkillDetail | undefined
}
createSkillCatalog(deps)
```

- `rebuild`: for each root, list each glob; read each copy (dir and slug from
  the path; skip unparsable paths, unreadable files and slugs failing
  contracts `SkillSlug`); group copies by slug; store `mergeCopies` under
  `scope/slug`.
- `mergeCopies`: copies ordered by dir precedence `.agents`, `.claude`,
  `.cursor`; `dirs` = distinct dirs in that order; preferred copy = first
  with no problem and a description, else the first; `problem = preferred.
problem ?? (no description ? "SKILL.md has no description" : undefined)`;
  `name = preferred.name || slug`; body/from from the preferred copy.
- `start`: rebuild, then one watcher per root on `SKILL_GLOBS`; a change
  re-reads every copy of that slug in that root (`<dir>/skills/**/SKILL.md`
  filtered by slug); none left → delete the entry; then publish
  `skill/update {kind: "skills_changed"}`.
- `list()` sorted by `scope/slug` (`localeCompare`).

### Read bindings (`read.ts`)

| Method       | Behaviour                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skill/list` | summaries (no body) sorted by key; `cursor` = `scope/slug` (unparsable or unknown → start at 0); `limit` default **100**; `next` = last key when more |
| `skill/get`  | `{scope, slug}`; missing → `not_found "Skill not found: <scope>/<slug>"`; detail with body                                                            |

Wire shape: `{slug: SkillSlug, name, description, scope, dirs, from? (only
when defined), problem}`.

### Install (`install.ts`)

```ts
const INSTALL_DIRS = [".agents", ".claude"]
type SkillSourceContent = { slug; name; description; body }
type SkillSourceReader = { getSkill(sourceId, version, slug): SkillSourceContent | null }
type SkillInstallDeps = { workspaceDocs: DocumentStore; catalog: SkillCatalog; bus: UpdateBus; sources: SkillSourceReader }
installSkill(deps, {sourceId, slug, version}): { skill } | { conflict }
uninstallSkill(deps, slug): void
createSkillInstallBindings(deps)      // skill/install, skill/uninstall
createFakeSkillSources(entries: {sourceId, version, skill}[]): SkillSourceReader
```

- `installSkill`: a workspace skill with that slug already exists →
  `{conflict: existing}`. Source missing → `not_found "Skill not found in
source: <sourceId>@<version>/<slug>"`. Write `formatSkillMd({..., from:
{sourceId, version}})` to `<dir>/skills/<slug>/SKILL.md` for `.agents` and
  `.claude` (failed write → `conflict "Could not write <path>"`); rebuild the
  catalog and publish `skills_changed`; catalog miss → `internal "Install
wrote files but catalog missed them"`.
- `uninstallSkill`: the workspace skill must exist and have `from`
  (installed), else `not_found "Installed skill not found:
workspace/<slug>"`; remove both install-dir copies (a `.cursor` copy or
  hand-written skills stay), rebuild, publish.
- `skill/install` binding: conflict → `conflict "Skill already installed"`
  with `data {current: wireDetail}`; else `{skill: wireDetail}`.
  `skill/uninstall` → `{}`.

### Sources (`sources.ts`)

```ts
const SOURCES_PATH = "skills/sources.json"     // { "sources": string[] }
readSourceIds(docs): string[]                  // missing/invalid → []
saveSources(deps: {docs, bus}, sources): string[]
listSources(deps): WireSkillSource[]           // [{ id, skills: offers }]
listOffers(docs, sourceId): WireSkillSourceOffer[]          // at item.current
listOffersAt(docs, sourceId, version): WireSkillSourceOffer[]
createLibrarySkillSourceReader(docs): SkillSourceReader
createSkillSourcesBindings(deps)               // skill/list_sources, skill/save
```

- `saveSources`: de-duplicate; every id must be a library item
  (`not_found "Library item not found: <id>"`); write pretty JSON
  `{"sources": [...]}` + `"\n"` (failure → `conflict "Could not write skill
sources"`); publish `skills_changed`; return the ids.
- `listOffersAt`: files `library/<id>/v<n>/skills/*/SKILL.md` matching
  `^library/([^/]+)/v(\d+)/skills/([^/]+)/SKILL\.md$` with the same id and
  version; parse; skip invalid slugs; `{slug, name, description, body}`
  sorted by slug.
- Library reader: reads `library/<id>/v<version>/skills/<slug>/SKILL.md`;
  missing, or a problem with no description → `null`.
- Bindings: `skill/list_sources` → `{items: listSources}`; `skill/save
{sources}` → `{sources: saved}`.

## files/

Generic text-file access for the UI, confined to allowed store roots.

| File             | Purpose                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paths.ts`       | `normalizeStorePath`, `isUnderStoreRoot`, `confineToRoots`                                                                                           |
| `service.ts`     | `createFileBindings` (`file/list`, `file/stat`, `file/read_text`, `file/write_text`, `file/reveal`)                                                  |
| `host-reveal.ts` | `createPeerHostReveal` (reveal through the client host)                                                                                              |
| `index.ts`       | barrel (`confineToRoots`, `isUnderStoreRoot`, `normalizeStorePath`, `createPeerHostReveal`, `createFileBindings`, `FileBindings`, `FileServiceDeps`) |

`normalizeStorePath(path)`: `\`→`/`, drop one leading `/`, skip empty and
`.` segments, `..` pops, `..` at the root → `null`. `isUnderStoreRoot(path,
root)`: normalized root `""` (or an escaping root) → always true; else equal
or descendant. `confineToRoots(path, roots)`: normalized path if under any
root, else `null`.

```ts
type FileServiceDeps = { docs: DocumentStore; allowedRoots: readonly string[]; reveal?: (path) => void | Promise<void> }
createFileBindings(deps): FileBindings
createPeerHostReveal(peer: { request(method, params?) }, connection: FcpConnection, toAbsolutePath): (storePath) => Promise<void>
```

Every method first confines `path` (`policy_denied "Path is outside allowed
roots"`).

| Method            | Behaviour                                                                                                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file/list`       | `path ?? ""` prefix. Lists `**`, keeps the prefix itself and descendants as `{path, kind: "file"}`, and synthesizes every intermediate directory under the prefix as `{path, kind: "dir"}`; sorted by path; cursor = path (unknown → start 0); `limit` default **100**; `next` = last path when more |
| `file/stat`       | existing file → `{path, kind: "file", hash, size: UTF-8 byte length}`; any descendant → `{path, kind: "dir"}`; else `not_found "Path not found: <path>"`                                                                                                                                             |
| `file/read_text`  | `{path, text, hash}` or `not_found "File not found: <path>"`                                                                                                                                                                                                                                         |
| `file/write_text` | write with `baseHash`; conflict → `conflict "Stale baseHash"` with `data {current: {path, text, hash}}`; `{path, hash}`                                                                                                                                                                              |
| `file/reveal`     | no `reveal` hook → `unsupported "Reveal is not available on this host"`; else `await reveal(path)`; `{}`                                                                                                                                                                                             |

`createPeerHostReveal`: when `connection.clientCapabilities.host.revealPath
=== true`, sends server→client request `host/reveal_path {path:
toAbsolutePath(storePath)}`; else throws `unsupported "Reveal is not
available on this host"`.

## settings/

```ts
type CliStatusPort = { listCliStatus(): Promise<readonly CliInfo[]> | readonly CliInfo[] }
type AppTrustPort = { getTrust(): TrustStatus; setTrust(grant: "always" | "none"): TrustStatus }
type McpTrustPort = { listServers(): readonly McpTrustEntry[]; setGrant(key: string, grant: "once" | "always" | "none"): readonly McpTrustEntry[] }
type SettingsPorts = { cli: CliStatusPort; trust: AppTrustPort; mcp: McpTrustPort }
createSettingsBindings(ports): SettingsBindings
```

(`CliInfo`, `McpTrustEntry`, `TrustDecision`, `TrustStatus` are contracts
types, re-exported by `settings/index.ts`; the package root exports only
`createSettingsBindings`, `SettingsBindings`, `AppTrustPort`,
`CliStatusPort`, `McpTrustPort`, `SettingsPorts`.)

| Method                    | Result                                     |
| ------------------------- | ------------------------------------------ |
| `settings/cli_status`     | `{clis: [...await listCliStatus()]}`       |
| `settings/get_trust`      | `trust.getTrust()`                         |
| `settings/set_trust`      | `trust.setTrust(grant)`                    |
| `settings/list_mcp_trust` | `{servers: [...mcp.listServers()]}`        |
| `settings/set_mcp_trust`  | `{servers: [...mcp.setGrant(key, grant)]}` |

Implementations live in `packages/adapters-node` (host).
