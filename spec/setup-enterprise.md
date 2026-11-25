# Build Flows on an enterprise-owned machine

How to stand up the monorepo from these specs on a managed Mac. It covers
prerequisites, corporate network settings, scaffold order and the checks
that prove each layer works. Tooling details are in [tooling.md](tooling.md).

## 1. Platform and prerequisites

Flows runs only on **macOS**. Task processes run inside `sandbox-exec`, and
the desktop shell uses macOS APIs such as Finder reveal and notifications.
Linux works for CI jobs only (audit, gitleaks), not for running the app.

| Tool                     | Version                               | Needed for                                           | Notes                                                                                                                                                       |
| ------------------------ | ------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS                    | 14+ (reference: Darwin 27)            | everything                                           | `sandbox-exec` is at `/usr/bin/sandbox-exec`. Some MDM profiles block it; set `FLOWAPP_SANDBOX=0` to run tasks unrestricted (the app shows a warning badge) |
| Xcode Command Line Tools | current                               | `git`, native toolchain                              | `xcode-select --install`                                                                                                                                    |
| Node.js                  | **≥ 22.5** (CI: 22, reference: 25.9)  | all                                                  | `node:sqlite` (`DatabaseSync`) must be present. `engines` says ≥ 20.19, but that is too low                                                                 |
| pnpm                     | 11.25.0 exactly                       | all                                                  | `corepack enable && corepack prepare pnpm@11.25.0 --activate`, or let `packageManager` pin it                                                               |
| git                      | ≥ 2.40                                | library work copies (`git clone --shared`, `git gc`) |                                                                                                                                                             |
| GitHub CLI `gh`          | any recent                            | GitHub connector (optional)                          | adapters run `gh` via `execFile`; sign in with `gh auth login`                                                                                              |
| Cursor Agent CLI `agent` | current                               | agent nodes via ACP (optional)                       | looked up on `PATH`; version probe is `agent --version`; ACP mode is `agent acp`                                                                            |
| Docker                   | any                                   | only for local gitleaks runs                         | optional                                                                                                                                                    |
| Playwright browsers      | match `@playwright/test ^1.65.1`      | `pnpm test:e2e`, desktop smoke                       | `pnpm --filter e2e exec playwright install chromium`                                                                                                        |
| Electron                 | `^45.4.1` (downloaded by postinstall) | desktop app                                          | allowed in `pnpm-workspace.yaml` `allowBuilds`                                                                                                              |

No database server, container or cloud service is required. All state
lives under `FLOWAPP_HOME`.

## 2. Corporate network and policy settings

Set these **before** `pnpm install`. Put user-level values in `~/.npmrc`.
Do not commit them: the repo has no `.npmrc` of its own.

| Concern                                    | Setting                                                                                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private npm registry / Artifactory / Nexus | `registry=https://<mirror>/api/npm/npm/` in `~/.npmrc`; plus `//<mirror>/…/:_authToken=${NPM_TOKEN}`                                                                                          |
| TLS-inspecting proxy                       | `export NODE_EXTRA_CA_CERTS=/path/corp-root.pem`; also `cafile=` in `~/.npmrc`                                                                                                                |
| HTTP proxy                                 | `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY=127.0.0.1,localhost` (**required**: the web app, server and e2e talk over loopback)                                                                  |
| Electron binary mirror                     | `ELECTRON_MIRROR=https://<mirror>/electron/` (and `electron_mirror` in `.npmrc`)                                                                                                              |
| Playwright browser mirror                  | `PLAYWRIGHT_DOWNLOAD_HOST=https://<mirror>/playwright`                                                                                                                                        |
| esbuild binary                             | comes from the npm package `@esbuild/darwin-arm64` (or `-x64`); make sure the mirror proxies optional deps                                                                                    |
| Blocked postinstall scripts                | `pnpm-workspace.yaml` allows builds only for `electron` and `esbuild` (`msw: false`). Approve them if a policy asks                                                                           |
| Endpoint security / EDR                    | allow `node`, `electron`, `sandbox-exec` and `agent` to spawn child processes. Allow `node` to listen on `127.0.0.1:8787` and `:5173`. Allow a Unix socket under `FLOWAPP_HOME` (MCP gateway) |
| Firewall prompts                           | none expected: nothing binds to `0.0.0.0`                                                                                                                                                     |
| Disk location                              | keep the repo and `FLOWAPP_HOME` off synced folders (iCloud, OneDrive). SQLite WAL and file watchers misbehave there                                                                          |

## 3. Scaffold order

Build bottom-up. After each step, that package's `pnpm --filter <pkg>
typecheck lint test` should pass before you move on.

| Step | Create                                                                                                                                                           | Spec                                                                             | Check                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 0    | root files: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.prettierrc`, `.prettierignore`, `.gitignore`, `eslint-dependency-guards.mjs` | [tooling.md](tooling.md)                                                         | `pnpm install` succeeds                                                    |
| 1    | `packages/protocol`                                                                                                                                              | [packages/protocol.md](packages/protocol.md)                                     | rpc/transport tests                                                        |
| 2    | `packages/contracts`                                                                                                                                             | [packages/contracts.md](packages/contracts.md)                                   | schema tests                                                               |
| 3    | `packages/docs-tools`, `docs/`                                                                                                                                   | [packages/docs-tools.md](packages/docs-tools.md)                                 | `pnpm docs:check`                                                          |
| 4    | `packages/core`                                                                                                                                                  | [packages/core.md](packages/core.md)                                             | engine tests with fakes                                                    |
| 5    | `packages/adapters-node`                                                                                                                                         | [packages/adapters-node.md](packages/adapters-node.md)                           | SQLite, fs, runner, sandbox tests                                          |
| 6    | `packages/agent-acp`, `packages/mcp-gateway`                                                                                                                     | [agent-acp.md](packages/agent-acp.md), [mcp-gateway.md](packages/mcp-gateway.md) | fake-agent tests                                                           |
| 7    | `packages/sdk`, `packages/sdk-react`                                                                                                                             | [sdk.md](packages/sdk.md), [sdk-react.md](packages/sdk-react.md)                 | client tests                                                               |
| 8    | `apps/server`                                                                                                                                                    | [apps/server.md](apps/server.md)                                                 | `pnpm --filter server start`; `curl 127.0.0.1:8787/health`                 |
| 9    | `packages/ui`                                                                                                                                                    | [packages/ui.md](packages/ui.md), [design-system.md](design-system.md)           | typecheck                                                                  |
| 10   | `apps/web`                                                                                                                                                       | [apps/web.md](apps/web.md)                                                       | `pnpm dev`, open `http://127.0.0.1:5173`                                   |
| 11   | `apps/cli`                                                                                                                                                       | [apps/cli.md](apps/cli.md)                                                       | `flows inbox` against the running server                                   |
| 12   | `apps/desktop`                                                                                                                                                   | [apps/desktop.md](apps/desktop.md)                                               | `pnpm --filter desktop build && pnpm --filter desktop start`; `test:smoke` |
| 13   | `apps/e2e`                                                                                                                                                       | [apps/e2e.md](apps/e2e.md)                                                       | `pnpm test:e2e`                                                            |

For shadcn components in step 9, use the shadcn CLI where the registry is
reachable: `pnpm dlx shadcn@latest add <name> -c apps/web`, style
`base-nova`. When it is blocked, write each component by hand from
[packages/ui.md](packages/ui.md).

## 4. Runtime layout

| Path                                              | What                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `$FLOWAPP_HOME` (default `~/.flowapp`)            | data root                                                                                                                                   |
| `app.db`                                          | SQLite: append-only `events` table plus `settings`                                                                                          |
| `engine.lock`                                     | single-engine lock, JSON `{pid, url, token}`, mode 0600; a second server or the desktop app attaches to it instead of starting a new engine |
| `workflows/<id>/`                                 | `workflow.yaml`, node files, layout file                                                                                                    |
| `docket/`                                         | board cards as plain files                                                                                                                  |
| `library/`, `connectors/`, `providers/`, `blobs/` | pulled data, connector config, agent providers, blob store                                                                                  |
| `mcp-trust.json`                                  | approved MCP servers                                                                                                                        |

Per-file formats are in [adapters-node.md](packages/adapters-node.md).

## 5. Daily commands

```bash
pnpm install
```

```bash
pnpm dev
```

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

"Done" means all four pass (AGENTS.md).

## 6. Security posture to keep

- Bind only to `127.0.0.1`. FCP websocket connections must pass the
  loopback `Host`/`Origin` checks and the `engine.lock` token
  ([apps/server.md](apps/server.md)).
- Task processes get their own process group, run in a sandbox, and have
  timeouts.
- Secrets go through the secrets adapter, never into `workflow.yaml` or
  the repo. CI runs gitleaks.
- `pnpm audit --prod --audit-level=moderate` gates merges.

## 7. Troubleshooting

| Symptom                                                   | Cause / fix                                                                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`                 | Node is older than 22.5. Upgrade                                                                                                                                                                 |
| Electron postinstall hangs or 403                         | set `ELECTRON_MIRROR`, or approve the build script                                                                                                                                               |
| e2e cannot connect to 5173/8787                           | proxy is catching loopback: add `127.0.0.1,localhost` to `NO_PROXY`                                                                                                                              |
| Tasks fail with `sandbox-exec: … Operation not permitted` | MDM blocks the sandbox: set `FLOWAPP_SANDBOX=0` and accept the warning                                                                                                                           |
| `could not acquire engine.lock under <home>`              | a stale lock is normally taken over (dead pid); if this persists, stop the other engine or delete the file. Only `ws://` owners can be attached to: a desktop or CLI engine blocks a second host |
| Agent node fails at pre-run check                         | `agent` is not on `PATH`, or the Cursor workspace is not trusted (`FLOWAPP_CURSOR_PROJECTS`)                                                                                                     |
