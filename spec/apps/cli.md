# `cli` — the `flows` command

Path: `apps/cli`. A thin FCP client. It either **attaches** to a live
daemon named in `$FLOWAPP_HOME/engine.lock`, or **hosts the engine
in-process** with the same stack as the daemon (`server/fcp-host`) over
linked transports. `flows engine --stdio` serves FCP over newline-delimited
JSON on stdin/stdout. Run with `tsx`; no build.

## package.json

```json
{
  "name": "cli",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "bin": { "flows": "./src/main.ts" },
  "scripts": {
    "start": "tsx src/main.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "dependencies": {
    "@workspace/adapters-node": "workspace:*",
    "@workspace/contracts": "workspace:*",
    "@workspace/protocol": "workspace:*",
    "@workspace/sdk": "workspace:*",
    "server": "workspace:*",
    "tsx": "^4.23.15"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@hono/node-server": "^2.1.11",
    "@types/node": "^26.6.6",
    "@types/ws": "^8.18.2",
    "eslint": "^10.15.0",
    "globals": "^17.14.0",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0",
    "vitest": "^5.1.1",
    "ws": "^8.23.0"
  }
}
```

`@hono/node-server` and `ws` are dev-only (tests start a real daemon via
`server/app`).

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "moduleResolution": "bundler"
  },
  "include": ["src", "vitest.config.ts"]
}
```

## vitest.config.ts

`defineConfig({ test: { include: ["src/**/*.test.ts"] } })`.

## eslint.config.js

Same as the server config (see [server.md](server.md#eslintconfigjs))
except: no `globalIgnores(["dist"])`; the recommended block targets
`**/*.{ts,tsx,mjs}`; the 300-line test override targets only
`**/*.test.{ts,tsx}`. Still includes `noCycleBlock`, `globals.node`, and
`max-lines` warn 200 / 300.

## Files

```
src/
  main.ts            entry (shebang), main(argv) -> exit code, direct-run detection
  args.ts            parseArgs(argv) -> CliCommand; HELP text
  home.ts            resolveHome(env)
  session.ts         openSession / openInProcess: attach or in-process host
  engine-stdio.ts    serveEngineStdio(home): FCP over stdin/stdout
  commands/inbox.ts  runInbox(home)
  commands/run.ts    runWorkflow({home, workflowId, cardId})
  *.test.ts          args, cli (attach/in-process/inbox/run), engine-stdio
```

## Environment

| Var            | Effect                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| `FLOWAPP_HOME` | Trimmed; if non-empty it is the home, else `~/.flowapp` (`join(os.homedir(), ".flowapp")`). |

## Entry (`src/main.ts`)

First line: `#!/usr/bin/env npx tsx`.

`export async function main(argv: string[]): Promise<number>`:

1. `parseArgs(argv)`; on throw write `<message>\n` to **stderr**, return `2`.
2. `home = resolveHome()` (computed for every command, including help).
3. Dispatch:
   - `help` → write `HELP` to stdout, return `0`.
   - `engine` → `serveEngineStdio(home)` then await a promise that never
     resolves (process lives until stdin closes or a signal).
   - `inbox` → `runInbox(home)`.
   - `run` → `runWorkflow({home, workflowId, cardId})`.

Direct-run detection: runs `main(process.argv.slice(2))` only when
`process.argv[1]` ends with `/main.ts` or `/main.js` or contains `/cli/`.
Non-zero result → `process.exitCode = code`; an uncaught rejection writes
`<message>\n` to stderr and sets `process.exitCode = 1` (no
`process.exit`, so the loop drains).

## Argument parsing (`src/args.ts`)

No flag library. `type CliCommand = {name:"engine"; stdio:true} |
{name:"inbox"} | {name:"run"; workflowId; cardId?} | {name:"help"}`.

| argv                                                         | Result / error message (exit 2)             |
| ------------------------------------------------------------ | ------------------------------------------- |
| `[]`, `help`, `--help`, `-h`                                 | help                                        |
| `engine ...` containing `--stdio` anywhere                   | engine (other args ignored)                 |
| `engine` without `--stdio`                                   | `usage: flows engine --stdio`               |
| `inbox`                                                      | inbox                                       |
| `inbox <anything>`                                           | `usage: flows inbox`                        |
| `run <workflow>`                                             | run                                         |
| `run <workflow> --card <id>` (flag may precede the workflow) | run with cardId                             |
| `run ... --card` with no / empty value                       | `usage: flows run <workflow> --card <id>`   |
| `run ... -x` (any other arg starting with `-`)               | `unknown flag: -x`                          |
| `run a b` (second positional)                                | `usage: flows run <workflow> [--card <id>]` |
| `run` (no workflow)                                          | `usage: flows run <workflow> [--card <id>]` |
| anything else                                                | `unknown command: <cmd>`                    |

`--card` repeated: last value wins. HELP text (exact, trailing newline):

```
flows — Flows client (FCP)

Usage:
  flows engine --stdio          Serve FCP on stdin/stdout
  flows inbox                   List open inbox items
  flows run <workflow> [--card <id>]
                                Start a run and stream until finished
```

## Sessions (`src/session.ts`)

Constants: `CLIENT_INFO = { name: "flows-cli", version: "0.0.1" }`,
`INPROC_URL = "inproc://flows-cli"`. Client capabilities always
`{ updates: { coalesced: true } }`.

```ts
type CliSession = {
  client: FlowsClient
  mode: "attach" | "in-process"
  close(): void
}
isInprocUrl(url) = !/^wss?:\/\//.test(url)
engineBusyMessage(pid) = `engine busy, pid ${pid}`
```

Self lock entry for in-process hosts: `{ url: "inproc://flows-cli", token:
randomBytes(32).toString("base64url") }` (token is never used by anyone).

**`openSession(home)`** (used by `inbox` and `run`):

1. `acquireLock(home, inprocSelf())`.
2. Live owner (`attachTo`):
   - non-ws URL → throw `engine busy, pid <pid>`;
   - ws URL → `createClient({ url, token, clientInfo, capabilities })`
     (sdk appends `?token=`; the WebSocket sends no `Origin`, which the
     daemon allows), `await client.ready`; mode `attach`; `close()` =
     `client.close()`.
3. Lock taken → `hostInProcess(home)`.

**`openInProcess(home)`**: like above but an owner of any kind throws
(`engine busy, pid <pid>` for non-ws, `FLOWAPP_HOME already owned at <url>`
for ws). Exported for tests.

**`hostInProcess(home)`**: `engine = createHost({home})`, `host =
createFcpHost(engine)`, `[serverT, clientT] = createLinkedTransports()`,
`bindFcpTransport(serverT, engine, host)` (no `blobsHttp`),
`createClient({ transport: clientT, clientInfo, capabilities })`, await
`ready`; mode `in-process`; `close()` = `client.close()`,
`host.dispose()`, `engine.close()`, `releaseLock(home)`.

Note: when the lock is taken but `createClient`/`ready` fails, the lock is
not released by this code path.

## `flows engine --stdio` (`src/engine-stdio.ts`)

`serveEngineStdio(home)`:

1. `acquireLock(home, { url: "inproc://flows-cli", token: random })`;
   owner → throw (`engine busy, pid <pid>` or `FLOWAPP_HOME already owned
at <url>`) — `main` turns this into stderr + exit code 1.
2. `engine = createHost({home})`, `host = createFcpHost(engine)`,
   `transport = ndjsonTransport(process.stdin, process.stdout)`.
3. `bindFcpTransport(transport, engine, host)` (no blobs capability).
4. `shutdown()` (idempotent): `host.dispose()`, `engine.close()`,
   `releaseLock(home)`. Called on `transport.onClose` (stdin end/error).
5. `SIGINT`/`SIGTERM` → `shutdown()` then `process.exit(0)`.

Wire format: one JSON-RPC message per line on stdout; nothing else is
written to stdout by the CLI in this mode (engine logs go to stderr).

## `flows inbox` (`src/commands/inbox.ts`)

`openSession(home)` → `client.call("inbox/list", {})`. For each item in
`items` write one tab-separated line to stdout:

- `kind === "permission"`: `<id>\t<kind>\t<status>\t<tool>\t<question>`
- otherwise: `<id>\t<kind>\t<status>\t<question>`

Return `0`. Always `session.close()` in `finally`. Errors propagate → exit
1 with message on stderr. Empty inbox prints nothing.

## `flows run <workflow> [--card <id>]` (`src/commands/run.ts`)

1. `openSession(home)`.
2. Register `client.onNotification("run/update", handler)` **before** any
   call:
   - `run_changed` with summary → stderr
     `run <runId> <summary.status> <taskCounts.done>/<taskCounts.total>\n`;
   - `step_state` → stderr `step <step.nodeId> <step.status>\n`;
   - `run_finished` → resolves the wait with `params.status` (not filtered
     by runId: the first `run_finished` seen on the `run` topic wins).
3. `call("subscribe", { topics: ["run"] })`.
4. `{runId} = call("run/start", { workflowId, requestKey: randomUUID(),
cardId? })` (cardId only if given).
5. `call("subscribe", { topics: ["run:<runId>"], since: 0 })`.
6. Await finish; unsubscribe the handler in `finally`.
7. Write `<status>\n` to stdout; return `0` if `succeeded`, else `1`.
   `session.close()` in `finally`.

RPC errors (unknown workflow → `not_found`, invalid inputs) reject →
message on stderr, exit 1. No timeout: a run waiting on approval blocks the
command.

## Exit codes

| Code | When                                                                                        |
| ---- | ------------------------------------------------------------------------------------------- |
| 0    | help; inbox listed; run `succeeded`                                                         |
| 1    | run finished `failed`/`cancelled`; any thrown error (busy lock, RPC error, connect failure) |
| 2    | argument parse error                                                                        |

## Tests (vitest)

- `args.test.ts`: engine/inbox/run(+card) parse; unknown command and bad
  run usage throw.
- `cli.test.ts` (temp homes `flowapp-cli-*`):
  - `openInProcess` takes `engine.lock` (`peekLock` sees it) and `close`
    releases it;
  - a second `openInProcess` fails with `engineBusyMessage(pid)` while
    the first holds the lock;
  - `runWorkflow` in-process on a trigger→command workflow returns 0 and
    stdout `succeeded`;
  - `runInbox` against a real daemon (`createApp` + `serve` on a free
    port, lock written with that ws URL and token `cli-attach-token`)
    prints the waiting approval (matches `approval\topen\tShip it?`);
    `run/start` with a card id uses a card at
    `docket/cards/<id>/card.md`;
  - `openSession` attaches (`mode: "attach"`) when the lock names a live
    ws owner.
- `engine-stdio.test.ts`: `bindFcpTransport(ndjsonTransport(PassThrough…))`
  - `createClient({transport: ndjsonTransport(...)})`; `inbox/list`
    returns `{items: []}`.
