# `@workspace/sdk-react` — React bindings for the FCP client

Path: `packages/sdk-react`. Context provider plus two hooks on top of a
`FlowsClient` from `@workspace/sdk`: `useQuery` (call once, refetch on
updates/resync) and `useSubscription` (forward update params). Topic
subscriptions are ref-counted per client so overlapping hooks share them.

## package.json

```json
{
  "name": "@workspace/sdk-react",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@workspace/sdk": "workspace:*" },
  "peerDependencies": { "react": "^19.0.0" },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@testing-library/react": "^16.3.3",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^10.15.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "globals": "^17.14.0",
    "jsdom": "^31.0.1",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0",
    "vitest": "^5.1.1"
  }
}
```

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

## vitest.config.ts

`defineConfig({ test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"] } })`.

## eslint.config.js

`globalIgnores(["dist"])`, `noCycleBlock`; `**/*.{ts,tsx}` extends
`js.configs.recommended`, `tseslint.configs.recommended`,
`reactHooks.configs.flat.recommended` with `globals.browser`; `max-lines`
warn 200 (`**/*.test.{ts,tsx}` / `**/*.spec.{ts,tsx}`: 300).

## Files

```
src/
  index.ts             public exports
  client-context.tsx   FlowsClientProvider, useFlowsClient, useOptionalFlowsClient
  topics.ts            topicToNotification, topicMatchesNotification, acquireTopics (ref-count)
  use-query.ts         useQuery
  use-subscription.ts  useSubscription
  fake-client.ts       createFakeClient() in-memory FlowsClient for tests (not exported)
  hooks.test.tsx       hook tests
```

## Public exports

`FlowsClientProvider`, `useFlowsClient`, `useOptionalFlowsClient`,
`useQuery`, `type UseQueryOptions`, `type UseQueryResult`,
`useSubscription`, `topicMatchesNotification`, `topicToNotification`.
(`acquireTopics` and `createFakeClient` are internal.)

## Context (`client-context.tsx`)

- `FlowsClientContext = createContext<FlowsClient | null>(null)`.
- `FlowsClientProvider({ client, children })` provides the client.
- `useFlowsClient()`: throws `useFlowsClient requires FlowsClientProvider`
  when null.
- `useOptionalFlowsClient()`: returns the client or `null` (browser
  without FCP bootstrap).

## Topics (`topics.ts`)

Topic grammar: `<namespace>` or `<namespace>:<id>` (e.g. `docket`,
`run:r-1`).

- `topicToNotification(topic)` → `"<ns>/update"` where `ns` is the part
  before the first `:`.
- `topicMatchesNotification(topic, notification)`: `ns` = notification
  without a trailing `/update` (otherwise the part before the first `/`);
  true when `topic === ns` or `topic` starts with `"<ns>:"`. (No id
  filtering client-side; the engine filters by id.)
- `acquireTopics(client, topics) → release()`: per-client
  `WeakMap<FlowsClient, {counts: Map<topic, n>}>`. Empty list → no-op
  release. Increment each topic; topics that went 0→1 are sent in one
  `client.call("subscribe", { topics: acquired })` (fire-and-forget,
  errors ignored as unhandled `void`). Release decrements each (missing
  counts treated as 1); topics reaching ≤ 0 are deleted and sent in one
  `client.call("unsubscribe", { topics: released })`. Duplicate topics in
  one list count twice.

## useQuery (`use-query.ts`)

```ts
type UseQueryOptions = { readonly topics: readonly string[] }
type UseQueryResult<T> = {
  data: T | undefined
  error: unknown
  loading: boolean
}
function useQuery<M extends FcpMethodName>(
  method: M,
  params: FcpCallParams<M>,
  options: UseQueryOptions
): UseQueryResult<FcpCallResult<M>>
```

Initial state: `data = undefined`, `error = null`, `loading = true`.

Identity keys: `paramsKey = JSON.stringify(params)`, `topicsKey =
topics.join("\0")` (so new array/object identities with equal contents do
not re-run effects).

Effect 1, deps `[client, topicsKey]`: `acquireTopics(client, topics)`;
cleanup releases.

Effect 2, deps `[client, method, paramsKey, topicsKey]`:

- local `alive = true`, `seq = 0`;
- `fetchOnce()`: `mine = ++seq`; `setLoading(true)`; `await
client.call(method, params)`; if still alive and `mine === seq`:
  success → `setData(result)`, `setError(null)`, `setLoading(false)`;
  failure → `setError(err)`, `setLoading(false)` (previous `data` kept).
  Stale responses are dropped (latest wins).
- run `fetchOnce()` immediately;
- for each distinct `topicToNotification(topic)`:
  `client.onNotification(name, () => if any topic matches name →
fetchOnce())` (update payload is ignored; it is a refetch trigger);
- `client.on("resync", topic => topics.includes(topic) && fetchOnce())`;
- cleanup: `alive = false`, remove notification and resync handlers.

`data` is not cleared when params change; `loading` goes back to `true`
while refetching. No debounce: each matching update triggers a call.

## useSubscription (`use-subscription.ts`)

```ts
function useSubscription(
  topic: string,
  handler: (params: unknown) => void
): void
```

Effect 1 `[client, topic]`: `acquireTopics(client, [topic])`.
Effect 2 `[client, topic, handler]`: `client.onNotification(
topicToNotification(topic), handler)`; cleanup removes it. Every
`<ns>/update` notification is forwarded (no id filtering client-side);
callers should memoize `handler` to avoid re-registering each render.

## Fake client (`fake-client.ts`, tests only)

`createFakeClient({ call? })` returns a `FlowsClient` plus
`emitNotification(method, params)`, `emitRequest(method, params)`
(throws `fake client: no handler for <method>`), `emitResync(topic)`, and
`calls: {method, params}[]` log. `ready` resolves `{ protocolVersion: 1,
engineInfo: {name: "fake", version: "0"}, engineCapabilities: {agents: [],
nodeKinds: []}, workspace: {home: "/tmp", id: "ws"} }`. Default `call`
rejects `fake client: no call handler`. `on` accepts only `"resync"`.

## Tests (`hooks.test.tsx`)

- `useQuery` returns data after the initial call;
- refetches on a matching `<ns>/update` notification;
- refetches on `resync` for a listed topic;
- surfaces call errors in `error`;
- does not resubscribe when the topics array identity changes but its
  contents match (only one `subscribe` call);
- params/data are typed for `docket/get_card` (type-level test);
- `useSubscription` invokes the handler for matching updates.
