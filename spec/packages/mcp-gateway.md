# `@workspace/mcp-gateway` — stdio MCP server forwarding to the engine socket

Path: `packages/mcp-gateway`. A tiny MCP server that an agent CLI (Cursor
`agent acp`) spawns over stdio. It advertises a fixed tool list read from a
launch JSON file and forwards every `tools/call` to the engine over a unix
domain socket as `gateway/call`, carrying a per-step token. It holds no
credentials and no connector code (DES-041 / BL-166 / BL-167).

Engine side of the socket: `packages/adapters-node/src/gateway-socket.ts`
(see [adapters-node-runtime.md](adapters-node-runtime.md), section `gateway-socket.ts`).
Launch spec (`command`, `args`, `env`) is built in
`packages/core/src/gateway/launch-spec.ts` (out of scope here); the agent
profile writes it into `.cursor/mcp.json` and/or ACP `session/new`
`mcpServers` (see [agent-acp.md](agent-acp.md#profilesplace-mcpts)).

## package.json

```json
{
  "name": "@workspace/mcp-gateway",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "tsx src/cli.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@workspace/protocol": "workspace:*", "zod": "^4.6.7" },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^26.6.6",
    "eslint": "^10.15.0",
    "globals": "^17.14.0",
    "tsx": "^4.23.15",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0",
    "vitest": "^5.1.1"
  }
}
```

No `bin` field and no build step. The engine launches it as
`tsx <path>/src/cli.ts --tools <file> --socket <path>` (or a bundled
equivalent); see `cli.ts` for the "direct run" detection.

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

## eslint.config.js

Flat config, `defineConfig([...])`:

1. `globalIgnores(["dist"])`.
2. `**/*.ts`: extends `js.configs.recommended` + `tseslint.configs.recommended`,
   `languageOptions.globals = globals.node`.
3. `**/*.{ts,tsx}`: `max-lines` warn, `{ max: 200, skipBlankLines: true, skipComments: true }`.
4. `**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`: `max-lines` warn at 300 (same options).

Unlike the other two packages in this spec, it does **not** include
`noCycleBlock` or any restricted-imports block.

## Files

```
src/
  args.ts          parseGatewayArgs (--tools, --socket)
  cli.ts           main(argv) + direct-run entry point
  engine-bridge.ts connectEngineBridge (ndjson JSON-RPC over unix socket), token env
  gateway.ts       createMcpGateway (MCP server over an RpcPeer)
  mcp-types.ts     MCP_PROTOCOL_VERSION, CallToolResult schema, asCallToolResult
  tools-spec.ts    zod schema of the launch tools JSON
  stub-socket.ts   startStubSocketServer (engine-side stub for tests; not exported from index)
  index.ts         public exports
  gateway.test.ts  unit + socket integration tests
```

## index.ts exports

`parseGatewayArgs`, `type GatewayArgs` (args.ts); `connectEngineBridge`,
`gatewayTokenFromEnv`, `GATEWAY_CALL_METHOD`, `GATEWAY_TOKEN_ENV`,
`type EngineCaller` (engine-bridge.ts); `createMcpGateway`,
`type CreateMcpGatewayOptions`, `type McpGateway` (gateway.ts);
`asCallToolResult`, `callToolResultSchema`, `MCP_PROTOCOL_VERSION`,
`type CallToolResult` (mcp-types.ts); `parseToolsSpec`, `toolSpecSchema`,
`toolsSpecSchema`, `type ToolSpec`, `type ToolsSpec` (tools-spec.ts).
`textContentSchema` (mcp-types.ts) is exported from its module only.
`stub-socket.ts` is not re-exported (tests import it directly).

## args.ts

```ts
export type GatewayArgs = { toolsPath: string; socketPath: string }
export function parseGatewayArgs(argv: string[]): GatewayArgs
```

- Walks argv left to right. `--tools <v>` and `--socket <v>` each consume the
  next item; a flag only counts when the next item is truthy (non-empty).
- Any other item, or a flag with no value, throws
  `Error("unknown or incomplete argument: <arg>")`.
- After the loop: missing tools → `Error("missing --tools <path>")`; missing
  socket → `Error("missing --socket <path>")` (tools checked first).
- A repeated flag overwrites the earlier value.

## tools-spec.ts

Launch tools JSON (file passed via `--tools`):

```ts
toolSpecSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).default({ type: "object" }),
})
toolsSpecSchema = z.object({ tools: z.array(toolSpecSchema) })
export function parseToolsSpec(input: unknown): ToolsSpec // toolsSpecSchema.parse (throws ZodError)
```

File shape example: `{ "tools": [ { "name": "rally.artifact_read",
"description": "...", "inputSchema": { "type": "object", ... } } ] }`.

## mcp-types.ts

| Export                    | Value / shape                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_PROTOCOL_VERSION`    | `"2024-11-05"`                                                                                                                                                               |
| `textContentSchema`       | `{ type: "text", text: string }`                                                                                                                                             |
| `callToolResultSchema`    | `{ content: textContent[] (min 1), isError?: boolean }`                                                                                                                      |
| `type CallToolResult`     | inferred from the schema                                                                                                                                                     |
| `asCallToolResult(value)` | If `value` parses, return the parsed data (zod strips unknown keys). Otherwise return `{ content: [{ type: "text", text: JSON.stringify(value ?? null) }] }` (no `isError`). |

## engine-bridge.ts

```ts
export const GATEWAY_CALL_METHOD = "gateway/call"
export const GATEWAY_TOKEN_ENV = "FLOWS_GATEWAY_TOKEN"
export type EngineCaller = {
  call(
    name: string,
    args: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<CallToolResult>
  close(): void
}
export function connectEngineBridge(
  socketPath: string,
  token: string
): Promise<EngineCaller>
export function gatewayTokenFromEnv(
  env?: Record<string, string | undefined>
): string
```

- `connectEngineBridge`: `net.createConnection({ path: socketPath })`. On
  connect, builds `ndjsonTransport(socket, socket)` (from
  `@workspace/protocol/node`) and an `RpcPeer`, then resolves. A socket
  `error` before connect rejects the promise (`socket.once("error", reject)`).
- `call(name, args, options)` → `peer.request("gateway/call", { name,
arguments: args, token }, options)`; the result is returned as-is (cast;
  validation happens in `gateway.ts`). `options.signal` aborts via the
  protocol's `$/cancel_request`.
- `close()` → `peer.close()`.
- `gatewayTokenFromEnv(env = process.env)`: returns `env.FLOWS_GATEWAY_TOKEN`;
  empty/missing throws `Error("missing env FLOWS_GATEWAY_TOKEN")`.

Wire format on the socket: one JSON-RPC 2.0 message per line (ndjson).
Request params: `{ "name": string, "arguments": object, "token": string }`.
Expected result: an MCP `CallToolResult`.

## gateway.ts

```ts
export type McpGateway = { peer: RpcPeer; close(): void }
export type CreateMcpGatewayOptions = {
  tools: ToolSpec[]
  engine: EngineCaller
  transport: Transport
  serverInfo?: { name: string; version: string }
}
export function createMcpGateway(opts: CreateMcpGatewayOptions): McpGateway
```

Creates `new RpcPeer(opts.transport)`. Default `serverInfo` is
`{ name: "flows-mcp-gateway", version: "0.0.0" }`. Handlers:

| Method                      | Kind         | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialize`                | request      | `{ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo }`. Params ignored.                                                                                                                                                                                                                                                                                                                        |
| `tools/list`                | request      | `{ tools: [{ name, description? (only when defined), inputSchema }] }` in spec order. No pagination.                                                                                                                                                                                                                                                                                                                 |
| `tools/call`                | request      | Read `params.name` (must be a string, else JSON-RPC error `-32602` `"tools/call requires name"`). Read `params.arguments` (plain non-array object, otherwise `{}`). Unknown name → error `-32602` `"unknown tool: <name>"` (engine not called). Otherwise `await engine.call(name, args, { signal: ctx.signal })` and return `asCallToolResult(raw)`. Engine errors propagate as the JSON-RPC error of this request. |
| `ping`                      | request      | `{}`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `notifications/initialized` | notification | ignored                                                                                                                                                                                                                                                                                                                                                                                                              |

Any other method gets the protocol's default "method not found". `close()`
closes the peer, then `engine.close()`.

## cli.ts

```ts
export async function main(argv: string[]): Promise<{ close(): void }>
```

1. `parseGatewayArgs(argv)`.
2. `parseToolsSpec(JSON.parse(readFileSync(toolsPath, "utf8")))`.
3. `gatewayTokenFromEnv()` (from `process.env`).
4. `await connectEngineBridge(socketPath, token)`.
5. `ndjsonTransport(process.stdin, process.stdout)` and
   `createMcpGateway({ tools: spec.tools, engine, transport })`; returned.

Direct-run detection at module load: runs `main(process.argv.slice(2))` when
`process.argv[1]` ends with `/cli.ts` or `/cli.js`, or contains
`mcp-gateway`. On rejection: writes `<message>\n` to stderr (Error message or
`String(err)`) and sets `process.exitCode = 1`. The process stays alive while
stdin/socket are open; it exits when they close.

## stub-socket.ts (test helper)

```ts
export type StubCall = { name: string; arguments: Record<string, unknown> }
export type StubSocketServer = {
  path: string
  calls: StubCall[]
  close(): Promise<void>
}
export async function startStubSocketServer(opts?: {
  token?: string
  result?:
    | CallToolResult
    | ((call: StubCall) => CallToolResult | Promise<CallToolResult>)
}): Promise<StubSocketServer>
```

- Socket path: `mkdtempSync(join(tmpdir(), "flows-mcp-gw-"))` + `/engine.sock`.
- Each connection gets an ndjson `RpcPeer` answering `gateway/call`. Name and
  token default to `""` when not strings. If `opts.token` is set and differs:
  JSON-RPC error `-32602` `"unknown step token"`. Arguments normalised to a
  plain object (else `{}`); `{ name, arguments }` pushed to `calls`.
- Default result: `{ content: [{ type: "text", text: JSON.stringify(call) }] }`.
- `close()` closes peers, destroys sockets, closes the server.

## Tests (gateway.test.ts) — behaviours pinned

- `parseGatewayArgs(["--tools","/t.json","--socket","/e.sock"])` →
  `{ toolsPath: "/t.json", socketPath: "/e.sock" }`; missing socket throws
  `/socket/`.
- `parseToolsSpec` rejects empty tool name.
- Over linked transports: `initialize` returns protocol version
  `2024-11-05`; `tools/list` omits `description` when absent and defaults
  `inputSchema` to `{ type: "object" }`.
- `tools/call` forwards name + arguments to the engine and returns its result
  verbatim; unknown tool → `JsonRpcResponseError` with code `-32602`.
- End to end through a real unix socket with the stub server and a token.
