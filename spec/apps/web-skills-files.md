# apps/web — Skills (`/skills`) and Files (`/files`)

Part of the [web spec](web.md). Files: `src/pages/skills/*` (11 source
files) and `src/pages/files/*` (5 source files).

# Skills

## File map

| File                  | Exports                                                                             | Role                                        |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `SkillsPage.tsx`      | `SkillsPage`                                                                        | Route; tabs Installed / Available / Sources |
| `SkillsStates.tsx`    | `SkillsLoading`, `SkillsLoadError`, `SkillsEmpty`                                   | States                                      |
| `SkillsTable.tsx`     | `SkillPick`, `InstalledTable`, `AvailableRow`, `AvailableTable`                     | Tables                                      |
| `SkillSheet.tsx`      | `SkillSheet`                                                                        | Skill detail Sheet                          |
| `SkillSheetParts.tsx` | `SkillStatusCard`, `SkillUsedBy`                                                    | Sheet parts                                 |
| `SkillSources.tsx`    | `SourcesList`, `useLibraryItems`                                                    | Sources tab                                 |
| `AddSourceDialog.tsx` | `AddSourceDialog`                                                                   | Pick a GitHub Library item as source        |
| `readers.ts`          | `readers`                                                                           | Which CLI reads a skill                     |
| `skill-actions.ts`    | `SkillActionResult`, `installSkill`, `uninstallSkill`, `updateSkill`, `saveSources` | FCP helpers                                 |
| `skill-usage.ts`      | `SkillUse`, `useSkillUses`                                                          | Workflow steps that list a skill            |
| `status.ts`           | `statusOf`, `whereLabel`                                                            | Status pill + location label                |

## FCP calls

| Method                                      | Params → result                                                                  | Where                      |
| ------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------- |
| `skill/list` (query, topic `skill`)         | `{}` → `{ items: WireSkillSummary[] }`                                           | page                       |
| `skill/list_sources` (query, topic `skill`) | `{}` → `{ items: WireSkillSource[] }` (`{ id, skills: WireSkillSourceOffer[] }`) | page                       |
| `library/list` (query, topic `library`)     | `{}`                                                                             | `useLibraryItems`          |
| `skill/get` (query, topic `skill`)          | `{ slug: SkillSlug, scope }` → `{ body, description, … }`                        | sheet (installed only)     |
| `skill/install`                             | `{ sourceId, slug: SkillSlug, version }`                                         | sheet                      |
| `skill/uninstall`                           | `{ slug: SkillSlug }`                                                            | sheet                      |
| `skill/save`                                | `{ sources: string[], requestKey: crypto.randomUUID() }`                         | add source / remove source |
| `library/pull`                              | via `pullItem` (library-actions)                                                 | Sources tab Sync           |
| `workflow/list`, `workflow/get` (calls)     |                                                                                  | `useSkillUses`             |

`WireSkillSummary`: `{ slug, name, description, scope: "workspace"|"home", dirs: string[] (e.g. ".agents", ".claude", ".cursor"), problem?, from?: { sourceId, version } }`.
`WireSkillSourceOffer`: `{ slug, description, body }`.

### Helpers

- `statusOf(skill, sourceCurrent?)`: problem → failed **Invalid**; no `from` → idle **Read-only**; source current > installed version → attention **Update available**; else done **Installed v<version>**.
- `whereLabel(skill)`: `"<~ if home else .>/<dirs joined " + ">/skills"` (e.g. `./.agents + .claude/skills`, `~/.agents/skills`).
- `readers(skill, all)` → `{ cursor: boolean, claude: string | null, note }`:

| Case                                             | cursor | claude          | note                                                       |
| ------------------------------------------------ | ------ | --------------- | ---------------------------------------------------------- |
| `problem`                                        | false  | null            | Not offered: it breaks the spec.                           |
| workspace, has `.claude`                         | true   | slug            | Both read it from the workspace.                           |
| workspace, no `.claude`                          | true   | null            | Claude Code reads only .claude/skills in the workspace.    |
| home, has `.claude`                              | true   | slug            | Both read it from your home folder.                        |
| home, another skill with same slug has `.claude` | true   | null            | Claude skips it: the same name exists in a .claude folder. |
| home otherwise                                   | true   | `agents:<slug>` | Claude reaches it through a generated plugin named agents. |

- `updateSkill` = `uninstallSkill` then `installSkill` (stops on first failure).
- All action helpers return `"ok" | "conflict" | message`.
- `useSkillUses(slug)`: on mount loads `workflow/list`, then `workflow/get` for every workflow sequentially, collects llm/agent nodes whose `skills` include the slug → `{ workflowId, workflow: name ?? id, node: id, step: name ?? id }`. Errors → `[]`.

## SkillsPage

- Gate pattern. Queries `skill/list`, `skill/list_sources`, `useLibraryItems()`.
- State: `pick: SkillPick | null` (`{slug, scope?, sourceId?}`), `adding`, `conflict`, `actionError`.
- `available` = every offer of every source, with `sourceId` and `source` = library item title (or id).
- `updates` = installed skills whose source library item `current` > `from.version`.
- Loading → `SkillsLoading`; error w/o data → `SkillsLoadError`.
- `<Page fill crumbs=[{label:"Skills"}] data-testid="skills-page">`:
  - Header action Button `skill-source-open` (`Plus`) **Add source**.
  - `PageTitle title="Skills"` description **Folders with a SKILL.md that Cursor and Claude Code read themselves. Found on disk and installed from GitHub sources.** + ` N update(s) available.` when >0.
  - Alert `skills-conflict`: **Conflict** / **This skill changed on disk. Close the sheet and try again.** or **Could not update** / message.
  - `Tabs defaultValue="installed"`: **On this machine (<n>)** (`skills-tab-installed`), **Available (<n>)** (`skills-tab-available`), **Sources (<n>)** (`skills-tab-sources`). Contents use `pt-3`.
    - installed: empty → `SkillsEmpty`; else `InstalledTable`.
    - available: empty → `p.text-sm.text-muted-foreground data-testid="skills-available-empty"` **No available skills yet. Add a GitHub source that keeps skills under skills/.**; else `AvailableTable`.
    - sources: `SourcesList`.
  - `SkillSheet`, `AddSourceDialog`.
- Picking a row clears page errors.

### States

- `SkillsLoading` (`Page fill`): **Loading skills…**; `skills-loading` with `Skeleton h-10 w-64` + `h-80 w-full`.
- `SkillsLoadError`: **Could not load skills.**; Alert `skills-error`.
- `SkillsEmpty`: `Empty data-testid="skills-empty"`, icon `Bot`, **No skills on this machine** / **Drop a SKILL.md folder under .agents, .claude or .cursor, or install from a source when Library sources are available.**

### InstalledTable

`Table data-testid="skills-installed"`; columns **Skill** | **Where** | **Read by** | **Status**. Row `skill-row-<scope>-<slug>` (click → pick `{slug, scope}`): slug (`font-medium`) over `max-w-96 truncate text-xs text-muted-foreground` description or **No description**; mono xs muted `whereLabel`; two CLI badges **Cursor** and **Claude Code** (`secondary` when read, else `outline text-muted-foreground line-through`); `StatusPill` from `statusOf(s, sourceCurrent)`.

### AvailableTable

`Table data-testid="skills-available"`; columns **Skill** | **Source** | **Status**. Row `skill-available-<slug>` (click → pick `{slug, sourceId}`): slug + description; muted source title; `StatusPill` done **Installed** when a workspace skill with that slug exists, else idle **Not installed**.

## SkillSheet

`SheetContent data-[side=right]:sm:max-w-lg data-testid="skill-sheet"`. Body:

- `installed` = skill with that slug and `pick.scope` (default `workspace`); `offer` = available row by slug (+ sourceId when given); `sourceId = pick.sourceId ?? installed.from.sourceId`; `item` = library item for sourceId; `scope = pick.scope ?? installed.scope ?? "workspace"`.
- Query `skill/get {slug, scope}` (used only when installed).
- `body = detail.body ?? offer.body ?? ""`; `description = detail.description ?? installed.description ?? offer.description`; `stale = installed.from && item.current > from.version`.
- Header (`pr-12`): title slug; description or **No description**.
- `SkillStatusCard` (`mx-4 flex flex-col gap-2 rounded-2xl bg-muted/50 p-3 ring-1 ring-foreground/10`):
  - Installed: `StatusPill`, muted **From <item title> v<from.version>** or **Found on disk, never edited by the app**; Button `skill-update` **Update to v<current>** when stale; outline `skill-uninstall` **Uninstall** when `from` (closes sheet on ok); xs muted readers note; when `from`: xs muted **This is a copy. Source updates change it only when you update.**
  - Not installed: muted **From <source label> v<version>** + Button `skill-install` **Install** → `installSkill({sourceId, slug, version: item.current})`; xs muted **Copies into `.agents/skills` and `.claude/skills` of the workspace.** (paths mono).
- Loading (installed): `skill-sheet-loading` (`px-4`, `Skeleton h-10 w-full`, `h-40 w-full`). Error: Alert `mx-4` `skill-sheet-error` **Could not load skill**.
- Scroll area `min-h-0 flex-1 overflow-y-auto px-4 pb-4`:
  - `SkillUsedBy`: `h3.pb-2.text-sm.font-medium.text-muted-foreground` **Used by steps (<n>)**; `div[data-testid="skill-used-by"]`; none → **No step uses it yet. Pick it in an agent step's settings.**; else Links to `/workflows/<id>` (`skill-used-<workflowId>-<node>`, `Bot` icon, step name, xs muted workflow name).
  - `h3` **SKILL.md** + `pre.font-mono.rounded-xl.p-3.text-xs.whitespace-pre-wrap.ring-1.ring-foreground/10 data-testid="skill-body"`.

## SourcesList

`div.flex.flex-col.gap-2 data-testid="skill-sources"`; empty → muted **No sources yet. Add a GitHub repo that keeps skills under skills/.**
`SourceRow` (`flex min-h-14 items-center gap-3 rounded-xl px-3 ring-1 ring-foreground/10`, `skill-source-<id>`):

- Title (library title or id) + mono xs muted remoteId; xs muted line `N skills · v<current> · fetched <YYYY-MM-DD> · ` + underlined Link **Open in Library** → `/library?item=<id>`.
- outline `skill-sync-<id>` (`RefreshCw` / `Spinner` + **Syncing…**, text **Sync**; disabled without remoteId) → `pullItem` (waits only for job start).
- ghost `skill-source-remove-<id>` **Remove** → `saveSources(all except id)`.

## AddSourceDialog

Props `open, onOpenChange, sourceIds, items`. `DialogContent sm:max-w-md data-testid="skill-source-add"`; title **Add skill source**; description **A GitHub repo already in the Library with skill folders under skills/. Sync it any time from the Sources tab.**

- `Input` autofocus, placeholder **Paste a GitHub repo URL or remote id**, `aria-label="Remote link"`, `skill-source-url`.
- Match among library items with `source === "github"` by `remoteUrl`, `remoteId` or `id` equal to the trimmed input.
- Messages: no match (non-empty) → muted **No matching GitHub Library item. Add the repo in Library first.**; already a source → destructive **Already a skill source.**; else muted **Use <b>title</b> as a source.**
- When input empty and candidates exist: xs muted **Or pick one:** + buttons `skill-source-pick-<id>` (title + mono remoteId) that fill the input with `remoteUrl ?? id`.
- Footer outline **Cancel**; `skill-source-submit` **Use as source** → `saveSources([...ids, id])`; conflict → **Conflict saving sources**.

# Files

## File map

| File                   | Exports                                             | Role                              |
| ---------------------- | --------------------------------------------------- | --------------------------------- |
| `FilesPage.tsx`        | `FilesPage`                                         | Route: tree + preview             |
| `FilePreview.tsx`      | `FilePreview`                                       | Load, edit, save, reveal one file |
| `FilePreviewParts.tsx` | `FilePreviewHeader`, `MarkdownViews`                | Header and markdown preview       |
| `file-meta.ts`         | `fileKindLabel`, `formatFileSize`, `formatStatLine` | Stat line                         |
| `list-files.ts`        | `listAllFilePaths`                                  | Page through `file/list`          |

## FCP calls

| Method                                | Params → result                                                                              | Where                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `file/list` (call, paged)             | `{ path?: prefix, cursor?, limit: 500 }` → `{ items: {path, kind: "file"\|"dir"}[], next? }` | `listAllFilePaths` (once on mount; no live refresh) |
| `file/read_text` (query, topics `[]`) | `{ path }` → `{ text, hash }`                                                                | preview                                             |
| `file/stat` (query, topics `[]`)      | `{ path }` → `{ kind, size? }`                                                               | preview                                             |
| `file/write_text`                     | `{ path, text, baseHash }` → `{ hash }`                                                      | Save                                                |
| `file/reveal`                         | `{ path }`                                                                                   | Reveal in Finder (host `host/reveal_path`)          |

Paths are relative to the app home (`FLOWAPP_HOME` / `~/.flowapp`); the UI shows the home as `~/.flowapp` (`HOME_LABEL = ".flowapp"`).

### file-meta.ts

- `fileKindLabel(path, kind)`: dir → **Folder**; ext yaml/yml → **YAML**, json → **JSON**, md → **Markdown**, db → **SQLite database**, else **File**.
- `formatFileSize(bytes)`: ≥1,000,000 → `X.X MB`; ≥1000 → `X.X KB`; else `N B` (decimal units).
- `formatStatLine(path, stat)`: `<kind>` or `<kind> · <size>`.

## FilesPage

- Gate pattern. State: `allPaths: string[] | null`, `loadError`, `query`, `selected`, `open: Set<string>` (expanded folders).
- On mount `listAllFilePaths(client)`.
- `paths` = allPaths filtered by case-insensitive substring; `roots = pathsToFileTree(paths)` (from `@workspace/ui/components/file-tree`; folders before files); `folders = folderPaths(roots)`; while searching every folder is shown open; `allOpen` = every folder open.
- Error: `<Page fill crumbs=[{label:"Files"}] data-testid="files-page">`, description **Could not list workspace files.**, Alert `files-error`.
- Loading: description **Loading workspace files…**, `files-loading` with `Skeleton h-10 w-full` + `h-80 w-full`.
- Ready: description **Workspace files under ~/.flowapp.**; grid `grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-5`:
  - Left (`md:col-span-2`, `flex min-h-0 flex-col gap-2 rounded-3xl p-2 ring-1 ring-foreground/10`):
    - Row: `InputGroup flex-1` with `Search`, placeholder **Search files**, `files-search`; outline icon Button `files-toggle-all` (disabled while searching) with `aria-label`/`title` **Collapse all** (`ChevronsDownUp`) or **Expand all** (`ChevronsUpDown`).
    - `p.px-1.text-xs.text-muted-foreground data-testid="files-count"` **N file(s)**.
    - Scroll `min-h-0 flex-1 overflow-y-auto`: empty → `Empty data-testid="files-search-empty"` **No files** / **The workspace has no files yet.** or **No matching files** / **Try a different search.**; else `FilesTree`.
  - Right (`md:col-span-3`, `min-h-0 overflow-y-auto rounded-3xl ring-1 ring-foreground/10`): `FilePreview path={selected if still in paths else null}`.

### FilesTree (`components/FilesTree.tsx`, shared)

Props `nodes: FileNode[], open: Set<string>, selected, onToggle(path, open), onSelect(path)`. `div.flex.flex-col.text-sm data-testid="files-tree"`.

- File: ghost Button `w-full justify-start font-normal` (+ `bg-accent text-accent-foreground` and `aria-current="true"` when selected), `data-testid="out-file-<path>"`, `File` icon + truncated name.
- Folder: controlled `Collapsible`; trigger ghost Button (`out-folder-<path>`, `aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50`) with `ChevronRight` (rotates 90° when open), `Folder` icon, name; content `div.ml-4.flex.flex-col` of children.
- `folderPaths(nodes)` returns every folder path depth-first.

## FilePreview

- No path → `Empty data-testid="files-empty"` icon `FileText`, **No file selected** / **Pick a file on the left to read it.**
- Body keyed by path. State: `draft`, `baseline` (last saved text), `hash`, `view: "raw"|"preview"` (default preview), `copied: "path"|"contents"|null`, `conflict`, `saveError`, `pending`, `revealing`.
- `text = draft ?? baseline ?? serverText`; `dirty = draft !== null && draft !== base`; `full = "~/.flowapp/<path>"`.
- Loading → `files-preview-loading` (`p-4`, `Skeleton h-8 w-1/2`, `h-40 w-full`). Error → Alert `m-4` `files-preview-error` **Could not read file**.
- Ready `div.flex.h-full.min-h-0.flex-col.gap-4.p-4 data-testid="files-preview"`:
  - `FilePreviewHeader`.
  - Alert `files-conflict`: **Conflict** / **This file changed on disk. Reload the page and try again.** or **Could not save** / message.
  - `Textarea` `min-h-40 text-xs font-mono`, `files-editor` (always editable).
  - Markdown files (`.md`) → `MarkdownViews`.
- Save → `file/write_text {path, text, baseHash}`; ok sets hash, baseline, clears draft.
- Reveal → `file/reveal {path}` → `toast.success("Revealed in Finder")` or `toast.error(message)`.

### FilePreviewHeader

- Row (`flex flex-wrap items-center gap-2`): `h2.min-w-0.flex-1.truncate.font-heading.text-base.font-medium` basename; outline **Copy path** (copies `full`), outline **Copy contents** (when text) — each shows `Check` + **Copied** for 1.5 s (`navigator.clipboard.writeText`); outline `files-reveal` (`FolderOpen`) **Reveal in Finder**; `files-save` **Save** (disabled unless dirty and not pending).
- Breadcrumb line xs muted: `~/.flowapp` then each parent folder, separated by `ChevronRight size-3`.
- Stat line xs muted `files-stat` from `formatStatLine`.

### MarkdownViews

`ToggleGroup` (`w-fit`) **Preview** / **Raw**. Preview → `div.min-h-0.flex-1.overflow-auto data-testid="files-markdown"` with `SummaryMarkdown` of the text minus a leading YAML front matter block (`/^---[\s\S]*?---\n/`). Raw → `pre.min-h-0.flex-1.overflow-auto.text-xs.font-mono`.
