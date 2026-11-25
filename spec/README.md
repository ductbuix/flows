# Flows rebuild specification

This spec is detailed enough to re-implement the Flows monorepo on another
machine and have it behave the same way. It covers the package layout,
exports, schemas, protocol methods, file formats, process behavior, UI
screens and tests. It describes the code as of `develop` @ `645eaa8`
(2026-11-25).

It is prose plus short signatures, not a copy of the source. It pins down
names, shapes, defaults, error codes and behavior. It does not pin down
statement-level code. If you need byte-identical files, use the git
history.

## Read in this order

1. [architecture.md](architecture.md): what the system is, the layers,
   runtime topologies and invariants.
2. [setup-enterprise.md](setup-enterprise.md): prerequisites,
   corporate proxy and registry settings, scaffold order, checks.
3. [tooling.md](tooling.md): root configs, turbo, ESLint layering
   guards, CI, environment variables.
4. Package specs, bottom-up:

| Order | Package                  | Spec                                                   |
| ----- | ------------------------ | ------------------------------------------------------ |
| 1     | `packages/protocol`      | [packages/protocol.md](packages/protocol.md)           |
| 2     | `packages/contracts`     | [packages/contracts.md](packages/contracts.md)         |
| 3     | `packages/docs-tools`    | [packages/docs-tools.md](packages/docs-tools.md)       |
| 4     | `packages/core`          | [packages/core.md](packages/core.md)                   |
| 5     | `packages/adapters-node` | [packages/adapters-node.md](packages/adapters-node.md) |
| 6     | `packages/agent-acp`     | [packages/agent-acp.md](packages/agent-acp.md)         |
| 7     | `packages/mcp-gateway`   | [packages/mcp-gateway.md](packages/mcp-gateway.md)     |
| 8     | `packages/sdk`           | [packages/sdk.md](packages/sdk.md)                     |
| 9     | `packages/sdk-react`     | [packages/sdk-react.md](packages/sdk-react.md)         |
| 10    | `apps/server`            | [apps/server.md](apps/server.md)                       |
| 11    | `packages/ui`            | [packages/ui.md](packages/ui.md)                       |
| 12    | design system            | [design-system.md](design-system.md)                   |
| 13    | `apps/web`               | [apps/web.md](apps/web.md)                             |
| 14    | `apps/cli`               | [apps/cli.md](apps/cli.md)                             |
| 15    | `apps/desktop`           | [apps/desktop.md](apps/desktop.md)                     |
| 16    | `apps/e2e`               | [apps/e2e.md](apps/e2e.md)                             |

Larger specs are split into `<name>-<area>.md` files, linked from their main
file:

- contracts: [core](packages/contracts-core.md), [nodes + docket](packages/contracts-nodes.md), [FCP](packages/contracts-fcp.md)
- core: [ports](packages/core-ports.md), [runs](packages/core-runs.md), [nodes](packages/core-nodes.md), [agents](packages/core-agents.md), [inbox](packages/core-inbox.md), [connectors](packages/core-connectors.md), [docket](packages/core-docket.md), [library](packages/core-library.md), [workspace](packages/core-workspace.md), [FCP binding](packages/core-fcp.md)
- adapters-node: [runtime](packages/adapters-node-runtime.md), [host](packages/adapters-node-host.md), [connectors](packages/adapters-node-connectors.md)
- ui: [components](packages/ui-components.md), [theme](packages/ui-theme.md)
- web: [shell + settings](apps/web-settings-shell.md), [docket](apps/web-docket.md), [inbox](apps/web-inbox.md), [workflows](apps/web-workflows.md), [canvas](apps/web-workflows-canvas.md), [connectors + library](apps/web-connectors-library.md), [skills + files](apps/web-skills-files.md), [brand + dev kit](apps/web-dev-brand.md)

## Current behaviour that may surprise you

The spec records these as they are. Decide per item whether the rebuild
keeps or fixes them.

| Area          | Behaviour                                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| web           | The YAML tab is a plain `Textarea`. `@codemirror/*`, `@uiw/react-codemirror` and `shiki` are declared but never imported                                                          |
| web           | No catch-all route: unknown paths render nothing. `index.html` links a missing `/vite.svg`                                                                                        |
| ui            | `shiki` and `zod` are declared but unused. The `scrollbar-thin`, `scrollbar-none` and `cn-toast` classes are not defined. DESIGN.md names a `Queue` component that does not exist |
| ui            | `Toaster` uses next-themes `useTheme`, but the app has its own ThemeProvider, so toasts always follow the `system` theme                                                          |
| core          | Rejecting an approval cancels the step and skips its downstream steps, but the run can still end `run_succeeded`                                                                  |
| core          | `llmProfileId` returns `"cursor"` for every CLI. `failed_precondition` maps to JSON-RPC `-32603`                                                                                  |
| adapters-node | MCP trust is implemented twice (`src/mcp-trust.ts`, `src/host/mcp/trust.ts`) over one `mcp-trust.json`. A second `placeMcp` overwrites the backup of `.cursor/mcp.json`           |
| agent-acp     | `mergeTodos` appends a duplicate id once per occurrence within one update                                                                                                         |
| cli           | `flows run` resolves on the first `run_finished` it sees, without checking the run id. A lock taken by a failed in-process session is not released                                |
| server        | The shutdown handler does not dispose the FCP host                                                                                                                                |
| sdk           | A call in flight when the connection drops is rejected as retryable, not re-queued. `ready` stays pending while reconnecting                                                      |
| root          | `engines.node` says ≥ 20.19, but `node:sqlite` needs ≥ 22.5                                                                                                                       |

## Related material in the repo

- `docs/designs/` (DES-014…DES-044): rationale and design history.
- `docs/backlogs/`: work items.
- `apps/web/DESIGN.md`: UI rules (summarized in [design-system.md](design-system.md)).
- `AGENTS.md`: current layout and commands.
