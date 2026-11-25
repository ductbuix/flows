# `@workspace/adapters-node` — `src/host/connectors/` (legacy in-repo connectors)

Part of [adapters-node.md](adapters-node.md). In-repo adapters for outside
systems (DES-026), keyed by id in a module registry. They operate on the
legacy `Connection` shape (see
[adapters-node-host.md](adapters-node-host.md#connections-legacy-shape)) and
back the library pull, work-copy diff and publish paths. No loading from
`FLOWAPP_HOME`: a new connector is code. BL-214 plans to retire them.

`README.md` in the folder documents: add a module exporting a `Connector`,
register it, cover with fake-backed tests; `fake` is test-only; builtins
(`github`, `confluence`, `rally`) are registered by the server via
`registerBuiltinConnectors()`; e2e sets `FLOWAPP_FAKE_CONNECTOR=1` so the
server also registers `fake` (read by the server, not this package).

## Files

```
connectors/
  README.md               how to add a connector
  index.ts                barrel
  types.ts                Connector + input/result types
  registry.ts             Map<id, Connector>
  builtins.ts             registerBuiltinConnectors()
  fake.ts                 test-only connector
  github/
    index.ts              createGithubConnector / githubConnector, shared mirror clone
    run.ts                runGh / runGit (execFile wrappers)
    repo.ts               remote/branch helpers, payload type
    diff.ts               githubDiff (commit dirty work, one push+draft PR op)
    publish.ts            githubPublish (push, gh pr create, receipts)
  confluence/
    index.ts              createConfluenceConnector / confluenceConnector
    helpers.ts            MCP_TRUST_REQUIRED, scope helpers, withClient
    page-files.ts         page.md / page.json snapshots, unifiedDiff
    diff-publish.ts       confluenceDiff / confluencePublish
    stub-client.ts        in-memory MCP client (tests)
    stub-mcp-server.mjs   stdio stub Confluence MCP server (tests)
  rally/
    index.ts              createRallyConnector / rallyConnector
    types.ts              base URL, cookie header, kind mapping
    http.ts               RallyHttpError, errorsOf, createRallyRequest
    client.ts             createRallyClient (WSAPI v2.0)
    files.ts              item.json / item.md, diffRallyDirs
```

## types.ts

```ts
type ConnectorPullInput = {
  connection: Connection
  entityKind: string
  entityId: string
  entityRoot: string
  destDir: string
  home: string
}
type ConnectorPullResult = { revision?: string }
type ConnectorDiffInput = {
  connection: Connection
  workCopyDir: string
  baseDir: string
  runId?: string
  publishTaskId?: string
}
type ConnectorPublishContext = { runRoot?: string; workCopyDir?: string }
type ConnectorChangeSet = {
  v: 1
  connection: string
  base: string
  ops: Array<{
    op: string
    target: string
    summary: string
    destructive: boolean
    payload: unknown
  }>
}
type ConnectorPublishResult =
  | { status: "applied"; result: Record<string, unknown>; undoNote: string }
  | { status: "conflict"; message: string }
  | { status: "rejected"; message: string }
type Connector = {
  id: string
  describe(): ConnectorDescribe // { id, entityKinds, scopeFields, signInMethods }
  check(connection, home): Promise<ConnectionCheckResult> // { ok, message, ambientLogin? }
  pull(input): Promise<ConnectorPullResult | void>
  diff(input): Promise<ConnectorChangeSet>
  publish(
    connection,
    changeSet,
    home,
    context?
  ): Promise<ConnectorPublishResult>
}
```

## registry.ts / builtins.ts

`registerConnector(c)` (replaces same id), `unregisterConnector(id)`,
`getConnector(id)`, `listConnectors()` (sorted by id), `clearConnectors()`.
`registerBuiltinConnectors()` registers `githubConnector`,
`confluenceConnector`, `rallyConnector` (not `fake`).

## Publish receipts (fake, github)

Idempotency: `fingerprint` = first 16 hex chars of SHA-256 of
`JSON.stringify(changeSet)`. Receipt file
`<home>/connections/<connectionId>/.publish-receipts/<fingerprint>.json`
holds the JSON outcome. If it exists, `publish` returns it unchanged
without side effects. Written only after the outcome (fake: any outcome;
github: only `applied`).

## fake.ts — `fakeConnector` (tests only)

`describe`: `{ id: "fake", entityKinds: ["item","repo","page"], scopeFields: ["label","ambient","domain","url","failPull","signedOut"], signInMethods: ["cli","mcp","cookies"] }`.

| Method    | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check`   | `scope.signedOut === "1"` → `{ ok: false, "fake signed out" }`; `signIn === "cookies"`: not signed in → `{ ok: false, "not signed in" }`, else `{ ok: true, "fake cookie sign-in ok" }`; `scope.ambient` set → `{ ok: true, "fake sign-in ok", ambientLogin: ambient }`; else `{ ok: true, "fake sign-in ok" }`                                                                                                                                                                                                                                                     |
| `pull`    | `signedOut === "1"` → throw `"signed out"`; cookies sign-in without cookies → `"not signed in"`; `scope.failPull` → throw with that text; else write `<destDir>/data.txt` = `scope.label ?? entityId`; returns `{}` (random revision)                                                                                                                                                                                                                                                                                                                               |
| `diff`    | Recursive file lists (skip `.git` and `meta.json`, follow symlinks) of work and base; for each path in the sorted union where text differs: only in work → `add` (destructive if path ends `.destructive`, equals `DELETE`, or text contains `__destructive__`), payload `{ text }`; only in base → `delete` (always destructive), payload `{ text: base }`; both → `edit` (destructive if `.destructive` suffix or work contains `__destructive__`), payload `{ before, after }`. `summary` = `"<op> <path>"`. `base` = `"pinned"` if baseDir exists else `"none"` |
| `publish` | cookies sign-in without cookies → `rejected "not signed in"`; receipt hit → stored; `scope.publishResult === "conflict"` → `conflict "fake conflict"`; `"rejected"` → `rejected (scope.publishMessage ?? "fake rejected")`; else `applied` with `result { url: "https://example.test/<id>/pr/<fp>", fingerprint }`, `undoNote "Close the fake PR for <id> (<fp>)"`; receipt written for every outcome                                                                                                                                                               |

## github

### run.ts

```ts
type CommandResult = { stdout: string; stderr: string; code: number }
type GithubRunner = {
  runGh(args): Promise<CommandResult>
  runGit(args): Promise<string>
}
```

- `runGh(args)`: `execFile("gh", args, { timeout: 15_000, encoding: "utf8" })`.
  Never throws: success `code 0`; `ENOENT` → `{ stdout: "", stderr: "ENOENT: gh not found", code: 127 }`;
  other failures → numeric `code` or `1`, captured stdout/stderr (stderr
  falls back to the error message).
- `runGit(args)`: `execFile("git", args, { timeout: 120_000, encoding: "utf8", maxBuffer: 16 MiB })`;
  returns stdout; throws `Error(stderr.trim() || message || "git failed", { cause })`.

### repo.ts

| Export                                           | Behaviour                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUSH_OP`                                        | `"push_branch_draft_pr"`                                                                                                                                                                                                                                                                     |
| `type GithubPublishPayload`                      | `{ branch, repo, remote, baseSha, headSha, defaultBranch, diff, force: boolean, workRepo }`                                                                                                                                                                                                  |
| `hostOf(conn)`                                   | trimmed `scope.host` or `"github.com"`                                                                                                                                                                                                                                                       |
| `remoteOf(conn, entityId)`                       | trimmed `scope.remote`, else `https://<host>/<entityId>.git`                                                                                                                                                                                                                                 |
| `repoEntityId(conn)`                             | `<owner>/<name>` from trimmed scope; missing → `Error("github connection <id> needs scope owner/name")`                                                                                                                                                                                      |
| `publishBranch(runId, taskId)`                   | `flows/<runId>/<taskId>`                                                                                                                                                                                                                                                                     |
| `findGitRepo(root)`                              | root itself if it has `.git`; else iterative search with a stack: for the popped dir, its child directories (skipping `.git`) are checked in `readdir` order and the first one containing `.git` is returned; otherwise all are pushed and the last pushed is visited next; none → undefined |
| `parsePayload(raw)`                              | type-check every payload field; else `null`                                                                                                                                                                                                                                                  |
| `ensureGitIdentity(repo, runGit)`                | if `git -C repo config --get user.email` is empty/fails: set `user.email flows@localhost`, `user.name Flows` (repo-local)                                                                                                                                                                    |
| `remoteBranchTip(remote, branch, runGit)`        | `git ls-remote <remote> refs/heads/<branch>`; first token if it matches `/^[0-9a-f]{7,40}$/i`; errors/empty → undefined                                                                                                                                                                      |
| `isAncestor(repo, a, b, runGit)`                 | `git -C repo merge-base --is-ancestor a b` succeeds                                                                                                                                                                                                                                          |
| `defaultBranchName(remote, runGit, runGh, repo)` | `git ls-remote --symref <remote> HEAD`, match `ref:\s*refs/heads/(\S+)`; fallback `gh repo view <repo> --json defaultBranchRef --jq .defaultBranchRef.name`; fallback `"main"`                                                                                                               |

### index.ts

Constants: `SHARED_CLONE = ".clone"`,
`AMBIENT_GH = "command tasks can use the ambient gh login on this machine"`.
`createGithubConnector(runner = { runGh, runGit })`; `githubConnector` is
the default instance. Also exports `type GithubRunner`.

- `describe`: `{ id: "github", entityKinds: ["repo"], scopeFields: ["owner","name","host","remote"], signInMethods: ["cli"] }`.
- `check(conn)`: `gh auth status -h <host>`; text = stdout + `\n` + stderr.
  `/ENOENT|not found/i` or code 127 → `{ ok: false, "GitHub CLI (gh) is missing" }`;
  `/Logged in to/i` → `{ ok: true, "signed in to <host>", ambientLogin: AMBIENT_GH }`;
  else `{ ok: false, "signed out of <host>" }`.
- `pull(input)`: kind must be `repo` (`Error("github connector only pulls repo, got <kind>")`).
  Shared mirror at `<entityRoot>/.clone`: missing → `git clone --mirror <remote> <clone>`;
  present → `git -C <clone> remote set-url origin <remote>` and
  `git -C <clone> fetch --prune origin +refs/*:refs/*`; then
  `git -C <clone> config gc.auto 0`. `sha = git -C <clone> rev-parse HEAD`
  (must match `/^[0-9a-f]{7,40}$/i`, else `Error("invalid commit sha from clone: <sha>")`).
  `rm -rf destDir`; `git clone --shared --no-checkout <clone> <destDir>`;
  `git -C <destDir> checkout --detach <sha>`; `git -C <destDir> config gc.auto 0`.
  Returns `{ revision: sha }` (revision dir is named by the sha).

### diff.ts — `githubDiff(input, runner)`

1. `workRepo = findGitRepo(workCopyDir)`; none → `{ v: 1, connection, base: "none", ops: [] }`.
2. `baseSha`: `rev-parse HEAD` in `findGitRepo(baseDir)` if found; else the
   first line of `git -C work rev-list --max-parents=0 HEAD` (root commit).
3. `ensureGitIdentity(workRepo)`; if `git status --porcelain` is non-empty:
   `git add -A`, `git commit -m "flows: publish changes"`.
4. `headSha = rev-parse HEAD`; equal to base → no ops, `base: baseSha`.
5. `diff = git -C work diff --binary <base>...<head>`.
6. `branch = flows/<runId || "local">/<publishTaskId || "local">` (trimmed);
   `repo = <owner>/<name>`; `remote = remoteOf(conn, repo)`;
   `defaultBranch = defaultBranchName(...)`.
7. `force`: if the remote branch exists at a different tip that is not an
   ancestor of head, `force` = whether that tip is a commit known locally
   (`git cat-file -t <tip>` = `commit`), i.e. a history rewrite; unknown
   tip → `false` (will be a conflict at publish).
8. One op: `{ op: "push_branch_draft_pr", target: branch, summary: "Push branch <branch> and open a draft pull request", destructive: force, payload: { branch, repo, remote, baseSha, headSha, defaultBranch, diff, force, workRepo } }`;
   `base: baseSha`.

### publish.ts — `githubPublish(connection, changeSet, home, runner, context?)`

1. Op = first `push_branch_draft_pr` op, else first op; none →
   `rejected "empty change set"`. Invalid payload →
   `rejected "invalid github publish payload"`.
2. Receipt hit → return it.
3. Work repo: `payload.workRepo` if it has `.git`; else
   `findGitRepo(context.workCopyDir ?? <context.runRoot>/work/<connId>)`;
   no root → `Error("github publish needs the work copy path")` (thrown);
   no repo → `Error("github publish: no git repo in work copy")`.
4. HEAD must equal `payload.headSha`, else
   `rejected "work copy HEAD <x> != change set <y>"`.
5. Remote tip differs and is not an ancestor and not `force` →
   `conflict "branch <branch> has other commits"`.
6. Push `git -C <work> push [--force] <remote> HEAD:refs/heads/<branch>`.
   Failure: message matching `/non-fast-forward|rejected/i` without force →
   the same conflict; else `rejected <message>`.
7. Draft PR: `gh pr create --repo <repo> --draft --head <branch> --base <defaultBranch> --title "flows: <branch>" --body <body>`
   where body = trimmed diff truncated to 60 000 chars, or
   ``Flows publish of `<branch>`.`` when empty. Non-zero exit: if output
   matches `/already exists/i`, `gh pr view <branch> --repo <repo> --json url --jq .url`
   and use a non-empty URL; else throw output text or
   `"gh pr create failed"`. Success: URL = last non-empty stdout line,
   must match `^https?://` else `Error("gh pr create did not return a URL: <stdout>")`.
   Any PR error → `rejected <message>`.
8. `applied` with `result { branch, url }` and undo note
   `Close the draft pull request (<url>), then delete the branch: gh pr close --delete-branch or: git push origin :refs/heads/<branch>`
   (three parts joined by single spaces); write the receipt.

Tests: `FLOWAPP_LIVE_GH=1` enables a live `gh auth status` test (skipped otherwise).

## confluence

Sign-in method `mcp`. Scope: `space`, `page`, and `command` (local stdio
MCP, run with `shell: true`) or `url`. The MCP server key (trimmed command,
else URL) must be allowed in `mcp-trust.json` or the session once-set of
`host/mcp/trust.ts`. Uses MCP tools `get_page` and `update_page` through
`host/mcp/client.ts` (no initialize handshake).

### helpers.ts

| Export                      | Behaviour                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `MCP_TRUST_REQUIRED`        | `"mcp_trust_required"`                                                             |
| `type ConfluencePage`       | `{ id: string; title: string; version: number; space: string; markdown: string }`  |
| `type ConfluenceMcp`        | `{ connect(input: McpConnectInput): Promise<McpClient> }`                          |
| `requireServerKey(conn)`    | key or `Error("confluence connection needs scope.command or scope.url")`           |
| `spaceOf(conn)`             | trimmed `scope.space` or `Error("confluence connection needs scope.space")`        |
| `pageIdOf(conn, entityId)`  | trimmed `scope.page`, else last `/` segment of entityId (or entityId)              |
| `asPage(result)`            | type-checks all five fields, else `Error("mcp get_page returned an invalid page")` |
| `withClient(mcp, conn, fn)` | `connect({ command: scope.command, url: scope.url })`, run, always `close()`       |

### page-files.ts

Revision/work layout: `page.md` (markdown) and `page.json`
(`{ id, title, version, space }`, pretty). Named `page.json` because
`meta.json` belongs to library revision metadata.
`readPageSnapshot(dir)` (null if missing/invalid), `writePageSnapshot(dir, { meta, markdown })`,
`unifiedDiff(before, after, path = "page.md")`: `""` when equal; else
`--- a/<path>`, `+++ b/<path>`, `@@ -1,<a lines> +1,<b lines> @@`, every
old line prefixed `-`, every new line prefixed `+`, joined with `\n` plus a
trailing `\n` (whole-file hunk, no LCS).

### index.ts — `createConfluenceConnector(mcp = { connect: connectMcp })`

- `describe`: `{ id: "confluence", entityKinds: ["page"], scopeFields: ["space","page","command","url"], signInMethods: ["mcp"] }`.
- `check(conn, home)`: signIn not `mcp` → `{ ok: false, "confluence requires sign-in method mcp" }`;
  key/space errors → `{ ok: false, <message> }`; not allowed →
  `{ ok: false, "mcp_trust_required: allow MCP server before use" }`; then
  `get_page { space, page: pageIdOf(conn, scope.page ?? "check") }`;
  success `{ ok: true, "mcp sign-in ok" }`, failure `{ ok: false, <message> }`.
- `pull`: kind must be `page` (`Error("confluence connector only pulls page, got <kind>")`);
  trust required (throws the same `mcp_trust_required: ...` text);
  `get_page { space, page }` → snapshot into `destDir`; revision =
  `String(page.version)`.
- `diff` → `confluenceDiff(conn, workCopyDir, baseDir)`.
- `publish` → `confluencePublish(mcp, conn, changeSet, home)`.
- Exports `confluenceConnector`, `MCP_TRUST_REQUIRED`, types `ConfluenceMcp`,
  `ConfluencePage`, `PageMeta`, `PageSnapshot`.

### diff-publish.ts

- `confluenceDiff`: no work snapshot → no ops, `base` = base version or
  `"none"`. Base exists with identical markdown and title → no ops. Else one
  op `{ op: "update_page", target: work.meta.id, summary: "update page <title>", destructive: false, payload: { unifiedDiff, markdown, title, space, version } }`
  (diff against base markdown or `""`); `base` = base version string or
  `"none"`.
- `confluencePublish`: not allowed → `rejected "mcp_trust_required: allow MCP server before use"`;
  no `update_page` op → `rejected "no update_page op"`; non-string markdown →
  `rejected "update_page missing markdown"`. Calls `update_page { space: payload.space ?? spaceOf(conn), page: op.target, version: Number(changeSet.base), title, markdown }`.
  Result `conflict: true` → `conflict (message ?? "page version conflict")`;
  else `applied` with `result { pageId, version: result.version ?? null, url: "confluence://<space>/<pageId>" }`,
  `undoNote "Revert Confluence page <id> to version <base>"`. Thrown errors
  matching `/conflict|version/i` → `conflict`, else `rejected`. No receipts.

### Test stubs

- `createStubMcpClient(initial?)` → `{ client, state }` with defaults
  `id "42"`, `title "Stub Page"`, `version 1`, `space "TEAM"`,
  `markdown "# Stub\n\nHello.\n"`. `update_page` with a different base
  version returns `{ conflict: true, message: "version conflict: base <b>, current <v>" }`;
  else applies markdown/title, bumps version, returns `{ version }`.
- `stub-mcp-server.mjs`: same over stdio; env `STUB_SPACE` (TEAM),
  `STUB_PAGE` (42), `STUB_TITLE` (Stub Page), `STUB_VERSION` (1),
  `STUB_MARKDOWN`, `STUB_CONFLICT=1` forces conflicts. Non-`tools/call`
  methods → error `-32000` `"unknown method <m>"`; unknown tools →
  `"unknown tool <name>"`. `get_page` echoes `args.space`.

## rally (WSAPI v2.0, cookie auth)

### types.ts

- `RallyFetch = (input: string, init?: RequestInit) => Promise<Response>`; `RallyJson = Record<string, unknown>`;
  `RallyClientOptions = { baseUrl, cookies: StoredCookie[], fetchFn? }`.
- `rallyBaseUrl(scope)`: trimmed `scope.url` or `scope.domain`; empty →
  `https://rally1.rallydev.com`; add `https://` when no `://`; return
  `<protocol>//<host>`; URL parse error → default.
- `cookieHeader(cookies)` = `name=value` joined with `"; "`.
- `typeNameForKind`: `defect` → `Defect`, `story` → `HierarchicalRequirement`,
  else `Error("rally connector only pulls story or defect, got <kind>")`.
- `pathForKind`: `defect` → `defect`, anything else → `hierarchicalrequirement`.

### http.ts

- `class RallyHttpError(message, status)` (`name = "RallyHttpError"`).
- `errorsOf(body)`: first top-level object value with an `Errors` array →
  its string items; else `[]`.
- `createRallyRequest(baseUrl, cookies, fetchFn = fetch)` →
  `request(path, init = {})`: sets `Cookie` header, `Content-Type:
application/json` when a body exists and no content type; URL =
  `baseUrl` without trailing `/` + path. Empty body → `{}`; non-JSON →
  `RallyHttpError("rally returned non-JSON (<status>)", status)`. Returns
  `{ status, body }`.

### client.ts — `createRallyClient(options)`

Base path `/slm/webservice/v2.0`.

| Method                                       | Request                                                                                          | Outcome                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getUser()`                                  | `GET /user`                                                                                      | 401/403 → `{ ok: false, "cookies expired" }`; ≥400 → `"rally check failed (<status>)"`; `Errors` matching `/not authorized\|invalid key\|session/i` → `"cookies expired"`, other errors → joined `"; "`; missing `body.User` object → `"cookies expired"`; else `{ ok: true }`                                                                                       |
| `getArtifact(kind, entityId)`                | `GET /<pathKind>/<encoded id>`                                                                   | On 404 or `Errors`: `GET /<pathKind>?query=<encoded "(FormattedID = <id>)">&pagesize=1&fetch=true`; no results → `RallyHttpError("rally <kind> <id> not found", status 200 ? 404 : status)`; else first result. Otherwise 401/403 → `"cookies expired"`; ≥400 → errors or `"rally pull failed (<status>)"`; missing `body[TypeName]` → `"rally <kind> missing body"` |
| `securityToken()`                            | `GET /security/authorize`                                                                        | 401/403 → `"cookies expired"`; `OperationResult.SecurityToken` non-empty string, else errors or `"rally security token missing"`                                                                                                                                                                                                                                     |
| `putArtifact(kind, objectId, fields, token)` | `PUT /<pathKind>/<oid>?key=<token>` body `{ <TypeName>: fields }`                                | 401/403 → `"cookies expired"`; ≥400 or errors → errors or `"rally update failed (<status>)"`                                                                                                                                                                                                                                                                         |
| `postComment(ref, text, token)`              | `POST /conversationpost/create?key=<token>` body `{ ConversationPost: { Text, Artifact: ref } }` | same pattern, `"rally comment failed (<status>)"`                                                                                                                                                                                                                                                                                                                    |

Artifact result: `object` gains `_typeName: <TypeName>`; `revision` =
`String(_objectVersion ?? VersionId ?? ObjectID)` when string/number, else
`String(ObjectID)` if usable, else `"unknown"`.
Re-exports `cookieHeader`, `pathForKind`, `rallyBaseUrl`,
`typeNameForKind`, `RallyHttpError`, types; `type RallyClient`.

### files.ts

- Files: `ITEM_JSON = "item.json"` (pretty JSON + `\n`), `ITEM_MD = "item.md"`,
  `COMMENT_MD = "comment.md"` (user-authored in the work copy).
- `writePulledItem(destDir, object)`: writes both. Markdown: `# <Name or "Untitled">`,
  empty line, `FormattedID: <x>` and/or `ScheduleState: <y>` lines (+ empty
  line when either exists), then the HTML-stripped `Description` (`<br>` →
  `\n`, `</p>` → `\n\n`, tags removed, `&nbsp; &amp; &lt; &gt;` decoded,
  trimmed) or `_No description._`, then a final empty line; joined with `\n`.
- `diffRallyDirs(connectionId, workDir, baseDir)`:
  - Comparable fields: top-level scalar (non-null, non-object) values as
    strings, skipping `_rallyAPIMajor, _rallyAPIMinor, _ref, _refObjectUUID, _objectVersion, _typeName, ObjectUUID, VersionId, Subscription, Workspace, Project, CreationDate, CreatedBy, LastUpdateDate, RevisionHistory, Discussion, Changesets`.
  - For each key in sorted union where values differ and the work value
    exists: `{ op: "field", target: key, summary: "change <key>", destructive: false, payload: { field, before: before ?? null, after } }`
    (fields removed in work produce nothing).
  - Trimmed `comment.md` in work, non-empty and different from base's →
    `{ op: "comment", target: "comment.md", summary: "add comment", destructive: false, payload: { text } }`.
  - Every payload gains `entityKind` (`defect` when work `_typeName` is
    `Defect`, else `story`), `objectId` (`String(ObjectID)` or `"unknown"`),
    `artifactRef` (work `_ref` when a string). `base = objectId`.

### index.ts — `createRallyConnector({ fetchFn? } = {})`

- `describe`: `{ id: "rally", entityKinds: ["story","defect"], scopeFields: ["workspace","project","url","domain"], signInMethods: ["cookies"] }`.
- Cookies: `readCookies(home, connection.id)`; none → `Error("not signed in")`.
- `check`: signIn not cookies → `{ ok: false, "rally requires cookies sign-in, got <m>" }`;
  not signed in → `"not signed in"`; `getUser()` result; thrown → message
  or `"rally check failed"`; ok → `"rally sign-in ok"`.
- `pull`: kind `story`/`defect` only; `getArtifact`; `writePulledItem`;
  `{ revision }`.
- `diff` → `diffRallyDirs`.
- `publish`: no ops → `applied { ops: 0 }`, undo `"No Rally changes were published."`.
  Else fetch a security token; walk ops collecting the last
  `objectId`/`entityKind`/`artifactRef` seen; `field` ops with string
  `after` accumulate `fieldUpdates[field ?? target]`; `comment` ops with
  non-blank text post immediately to `artifactRef` or
  `/<defect|hierarchicalrequirement>/<objectId>` (none →
  `rejected "rally comment missing artifact ref"`). Then, if any field
  updates: need objectId and entityKind (else
  `rejected "rally field update missing object id"`) and one PUT. Result
  `applied { objectId ?? null, fields: keys, comments }`, undo
  `"Revert the Rally field changes and delete the conversation posts in Rally."`.
  Errors: `RallyHttpError("cookies expired")` → `rejected "cookies expired"`;
  message matching `/conflict|has been modified|concurrent/i` → `conflict`;
  else `rejected` (`"rally publish failed"` default). No receipts.

## Tests — behaviours pinned

- github: describe; scope entity `owner/name`; check signed in / out /
  missing CLI; one shared clone and detached checkout per pull; diff
  commits dirty work into a single draft-PR op; publish pushes, opens the
  PR, returns the undo note; remote branch with foreign commits is a
  conflict while a moved default branch is not; force push flagged
  destructive.
- confluence: scope entity `space/page` skips `command`; check requires MCP
  trust; pull writes markdown + meta with revision = page version; diff and
  publish with version check; real stdio stub server.
- rally: scope entity from workspace/project; missing and expired cookies;
  pull writes `item.json` + `item.md`; diff/publish of a comment and a
  field change.
