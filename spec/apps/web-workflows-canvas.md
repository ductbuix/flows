# apps/web — Workflow canvas (React Flow)

Part of the [web spec](web.md); hosted by `EditorChrome` in
[web-workflows.md](web-workflows.md). Files: `src/pages/workflows/canvas/*`
(33 source files). Built on `@xyflow/react` (`^13.0.2`), with
`@dagrejs/dagre` (`^3.1.3`) for auto-layout of unplaced nodes. Imports
`@xyflow/react/dist/style.css` once in `WorkflowCanvas.tsx`.

## File map

| File                       | Exports                                                                                                                                 | Role                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `WorkflowCanvas.tsx`       | `WorkflowCanvas`                                                                                                                        | ReactFlow host; wires hooks, context, chrome, logs sheet |
| `CanvasChrome.tsx`         | `CanvasChrome`                                                                                                                          | Background, settings panel, run bar, toolbar             |
| `CanvasToolbar.tsx`        | `CanvasToolbar`                                                                                                                         | Bottom-center: undo, redo, fit, add node                 |
| `AddNodeMenu.tsx`          | `AddNodeMenu`                                                                                                                           | Popover kind picker with search                          |
| `RunBar.tsx`               | `RunBar`                                                                                                                                | Top-right: draft/run select, card picker, start, banner  |
| `NodeSettings.tsx`         | `NodeSettings`                                                                                                                          | Top-right settings panel for a node                      |
| `node-settings-fields.tsx` | `TIMEOUT_OPTS`, `RETRY_OPTS`, `Choice`, `timeoutMin`, `retryMax`, `StepLimits`, `AllowLists`, `SystemPromptField`                       | Settings fields                                          |
| `StepConnectors.tsx`       | `ConnectorCount`, `ConnectorList`, `SkillList`                                                                                          | Connector/skill chips and pickers                        |
| `MultiPick.tsx`            | `MultiPick`, `PickOption`                                                                                                               | Chip combobox                                            |
| `ModelRow.tsx`             | `ModelRow`, `ModelPatch`                                                                                                                | CLI / model / effort selects on cards                    |
| `FlowNodes.tsx`            | `PromptNode`, `LlmNode`, `CommandNode`, `JudgeNode`                                                                                     | Node renderers                                           |
| `FlowNodesIO.tsx`          | `TriggerNode`, `AssetNode`, `ApprovalNode`, `OutputNode`                                                                                | Node renderers                                           |
| `NodeShell.tsx`            | `NodeShell`, `FIELD`                                                                                                                    | Shared node frame + toolbar + state                      |
| `NodePorts.tsx`            | `PORT_STYLE`, `PortHandle`, `KindPorts`                                                                                                 | Typed handles                                            |
| `NodeFields.tsx`           | `NodeFileField`, `NodeYamlField`                                                                                                        | In-card text areas                                       |
| `NodeRunFooter.tsx`        | `NodeRunFooter`                                                                                                                         | Inbox ask, result, Retry, Logs                           |
| `NodeInboxPrompt.tsx`      | `NodeInboxPrompt`, `NodeInboxItem`                                                                                                      | Approval/permission answered on the node                 |
| `NodeLogsButton.tsx`       | `NodeLogsButton`                                                                                                                        | Opens logs sheet                                         |
| `NodeLogDialog.tsx`        | `NodeLogDialog`, `CanvasNodeLogs`                                                                                                       | Logs Sheet                                               |
| `NodeLogEntries.tsx`       | `Output`, `NodeLogLoading`, `NodeLogEntries`                                                                                            | Log entry rendering                                      |
| `TriggerInputs.tsx`        | `TriggerInputs`                                                                                                                         | (used by WorkflowSheet, see workflows spec)              |
| `flow-graph.ts`            | `CanvasNode`, `CanvasEdge`, `workflowEdgesToCanvas`, `nodeTypeOf`, `workflowToCanvas`, `canvasToLayout`, `portsFor`, `connectionToEdge` | Workflow ↔ canvas mapping                                |
| `flow-kinds.ts`            | `KIND_LABEL`, `KIND_ICON`, `KIND_GROUPS`, `HAS_SETTINGS`, `RunState`, `CanvasNodeData`, `kindLabel`                                     | Kind tables                                              |
| `flow-context.ts`          | `FlowActions`, `FlowContext`, `useFlow`                                                                                                 | Actions context for node cards                           |
| `canvas-styles.ts`         | `SELECTED_EDGE`, `DEFAULT_EDGE_OPTIONS`, `CONNECTION_LINE_STYLE`                                                                        | Edge styles                                              |
| `node-types.ts`            | `nodeTypes`                                                                                                                             | React Flow type map                                      |
| `default-node.ts`          | `defaultNode`, `cloneNodeRecord`, `newNodeId`                                                                                           | New node records                                         |
| `resolve-collisions.ts`    | `resolveCollisions`, `CollisionOptions`                                                                                                 | Push overlapping nodes apart                             |
| `node-logs.ts`             | `showsLogButton`, `parseTrace`, `LogEntry`, `parseEntries`                                                                              | Log helpers                                              |
| `node-run-view.ts`         | `stepToRunState`, `PassInfo`, `StepView`, `statesFromSteps`                                                                             | Run step → node state                                    |
| `use-canvas-ops.ts`        | `useCanvasOps`                                                                                                                          | YAML + layout mutations                                  |
| `use-canvas-connect.ts`    | `useCanvasConnect`                                                                                                                      | Wire rules, edge removal, drag stop                      |
| `use-canvas-keys.ts`       | `useCanvasKeys`                                                                                                                         | Keyboard duplicate/delete                                |
| `use-canvas-actions.ts`    | `useCanvasActions`                                                                                                                      | Builds `FlowActions`                                     |
| `use-canvas-run.ts`        | `useCanvasRun`, `NodeView`                                                                                                              | Follow one run                                           |
| `use-run-overlay.ts`       | `useRunOverlay`                                                                                                                         | Run list, card picker, start, overlay                    |
| `use-editor-history.ts`    | `useEditorHistory`, `EditorSnapshot`                                                                                                    | Undo/redo                                                |
| `use-node-file.ts`         | `useNodeFile`, `nodeFilePath`                                                                                                           | Node-file text load/save                                 |
| `use-system-prompt.ts`     | `useSystemPrompt`                                                                                                                       | `system.md` for LLM nodes                                |

## FCP calls

| Method                                      | Params                                                                                                                | Where                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `run/list` (query, topic `run`)             | `{ workflowId, limit: 100 }`                                                                                          | useRunOverlay                |
| `docket/list_cards` (query, topic `docket`) | `{}`                                                                                                                  | useRunOverlay                |
| `inbox/list` (query, topic `inbox`)         | `{}`                                                                                                                  | useRunOverlay                |
| `run/get` (call)                            | `{ id }` → `RunSummary & { steps?: RunStep[] }`                                                                       | useCanvasRun                 |
| subscription `run:<runId>`                  | notifications `step_state` (`step`), `run_changed` / `run_finished` (`summary`)                                       | useCanvasRun                 |
| `run/get_log`                               | `{ runId, stepId, pass, attempt, stream: "stdout"\|"stderr"\|"events", offset }` → `LogChunk {text, nextOffset, eof}` | useCanvasRun, NodeLogDialog  |
| `run/retry_step`                            | via `retryStep(client, runId, stepId)`                                                                                | useCanvasRun                 |
| `run/start`                                 | via `startRun({workflowId, cardId})`                                                                                  | useRunOverlay                |
| `inbox/answer`                              | via `answerInboxItem`                                                                                                 | NodeInboxPrompt              |
| `file/read_text`                            | `{ path }` → `{ text, hash }`                                                                                         | useNodeFile, useSystemPrompt |
| `file/write_text`                           | `{ path, text, baseHash? }` → `{ hash }`                                                                              | useNodeFile, useSystemPrompt |
| `library/list` (query, topic `library`)     | `{}`                                                                                                                  | AssetNode                    |
| `connector/list` (query, topic `connector`) | `{}`                                                                                                                  | ConnectorList                |
| `skill/list` (query, topic `skill`)         | `{}`                                                                                                                  | SkillList                    |

Node files live at `workflows/<workflowId>/nodes/<nodeId>/<file>` (store-relative path).

## Kind tables (`flow-kinds.ts`)

| Kind       | Label    | Icon          | Settings panel | Card width | React Flow type                       |
| ---------- | -------- | ------------- | -------------- | ---------- | ------------------------------------- |
| `trigger`  | Trigger  | `Zap`         | no             | `w-72`     | `flow-trigger` → TriggerNode          |
| `prompt`   | Prompt   | `FileText`    | no             | `w-96`     | `flow-prompt` → PromptNode            |
| `asset`    | Asset    | `FileText`    | no             | `w-96`     | `flow-asset` → AssetNode              |
| `agent`    | Agent    | `Bot`         | yes            | `w-96`     | `flow-agent` → LlmNode (retired kind) |
| `command`  | Command  | `Terminal`    | yes            | `w-96`     | `flow-command` → CommandNode          |
| `llm`      | LLM      | `Bot`         | yes            | `w-96`     | `flow-llm` → LlmNode                  |
| `judge`    | Judge    | `GitFork`     | yes            | `w-96`     | `flow-judge` → JudgeNode              |
| `approval` | Approval | `HandHelping` | no             | `w-72`     | `flow-approval` → ApprovalNode        |
| `output`   | Output   | `Bell`        | no             | `w-72`     | `flow-output` → OutputNode            |

`KIND_GROUPS` (add menu): **Inputs** trigger, prompt, asset; **Steps** llm, command; **Flow** judge, approval, output. (Agent is not offered.)

`nodeTypeOf(kind) = "flow-" + kind` (prefixed so React Flow's built-in `output` styles never apply).

`RunState = "running" | "done" | "failed" | "waiting" | "skipped"`.

`CanvasNodeData`: `kind, name?, summary?, question?, title?, run?, mode?: "rule"|"check", target?: "notify"|"folder"|"publish", channel?: "app"|"system", items?: string[], cli?: "claude"|"cursor", model?, effort?, connectors?: string[], skills?: string[], state?: RunState, result?, failReason?, attempt?, pass?, passes?: {pass, attempts}[]`.

Ports come from contracts `PORT_TABLE` (`portsFor(kind)` falls back to `{in:["text"], out:["text"]}`):

| Kind                     | in         | out        | branches |
| ------------------------ | ---------- | ---------- | -------- |
| trigger                  | –          | text       |          |
| prompt                   | –          | text       |          |
| asset                    | –          | text, file |          |
| llm                      | text, file | text       |          |
| agent, command, approval | text, file | text, file |          |
| judge                    | text, file | text, file | yes, no  |
| output                   | text, file | –          |          |

## flow-graph.ts

- `workflowToCanvas(workflow, layout)` → `{ nodes, edges }`. Positions from
  `layout.nodes[id]`; if any node lacks a position, run dagre over the whole
  graph (`rankdir: "LR"`, `nodesep: 48`, `ranksep: 80`, node box 280×120)
  and fill only missing ids with `center − (140, 60)`; default `{0,0}`.
  Node: `{ id, type: nodeTypeOf(kind), position, data: dataOf(node) }`.
- `summaryOf`: trigger **Manual**; command `run`; approval `question`;
  output `title ?? target`; asset `"<n> library items"`; judge **Check**
  (mode check) or **Rule**; agent/llm `cli`; prompt `name`.
- `dataOf` copies: `cli/model/effort` for agent/llm/judge; `connectors/skills` for agent/llm (as strings); `question` (approval); `title/target/channel` (output); `run` (command); `mode` (judge, default `rule`); `items` (asset, as strings).
- `workflowEdgesToCanvas(edges)`: each `{ id: "<from>-<branch|port|text>-<to>-<port|text>", type: "smoothstep", pathOptions: { borderRadius: 16, offset: 32 }, source: from, target: to, sourceHandle: branch ?? port, targetHandle: port, label: branch ? ("Yes"|"No"|branch) : undefined }` (port default `text`).
- `canvasToLayout(nodes, viewport?)` → `{ version: 1, nodes: {id: {x, y}}, viewport? }`.
- `connectionToEdge(conn, kindOf)` → `WorkflowEdge | null`. Rejects unknown kinds and self loops. `port = targetHandle ?? "text"` must be in the target's `in`. If source kind has branches: `sourceHandle` must be a branch and `port` in source `out`; else `sourceHandle ?? "text"` must equal `port` and be in source `out`. Result `{ from, to, port? (only "file"), branch? }`.

## canvas-styles.ts

- `DEFAULT_EDGE_OPTIONS`: `type: "smoothstep"`, style `strokeDasharray: "6 6"`, `stroke: var(--muted-foreground)`.
- `SELECTED_EDGE`: `stroke: var(--ring)`, `strokeWidth: 2` (applied to edges with `selected`).
- `CONNECTION_LINE_STYLE`: `stroke: var(--ring)`, `strokeWidth: 2`, `strokeDasharray: "6 6"`.

## default-node.ts

- `newNodeId(kind) = "<kind>-<Date.now().toString(36)>"`.
- `defaultNode(kind, id)`: trigger `{type:"manual"}`; prompt `{}`; asset `{resources: []}`; agent/llm `{cli:"claude"}`; command `{run:"echo ok"}`; judge `{mode:"rule", cli:"claude"}`; approval `{question:"Continue?"}`; output `{target:"notify", title:"Done"}` (all plus `id`, `kind`).
- `cloneNodeRecord(node, id)` = `structuredClone(node)` with new id.

## WorkflowCanvas

Props: `workflowId, workflow: Workflow, yaml, layout, onYamlChange, onLayoutChange, history, runView: string, onRunView`.

- Mount seed: `workflowToCanvas(workflow, layout)` → `useNodesState` / `useEdgesState`.
- Effect on `[workflow, layout]`: recompute and replace nodes (keeping each node's `selected`) and edges.
- `viewportRef` starts at `layout.viewport`; updated on `onMoveEnd`.
- State `settingsId` (node whose settings panel is open), `logNodeId`.
- Hooks: `useSystemPrompt(workflowId)`, `useCanvasOps(..., onRemoved: close settings if it was that node)`, `useRunOverlay(workflowId, nodes, runView, onRunView)`, `useCanvasConnect`, `useCanvasKeys(..., enabled = !readOnly)`, `useCanvasActions`.
- `editing` = node with `settingsId` (only when not read-only).
- Wrapper `div.min-h-0.flex-1.overflow-hidden.rounded-3xl.ring-1.ring-foreground/10 data-testid="workflow-canvas"`; `FlowContext.Provider value=actions`.
- `ReactFlow` props:

| Prop                                                                                            | Value                                                               |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `nodes`                                                                                         | `overlay.shown`                                                     |
| `edges`                                                                                         | edges with `SELECTED_EDGE` style when selected                      |
| `nodeTypes`                                                                                     | `nodeTypes`                                                         |
| `onNodesChange` / `onEdgesChange` / `onNodeDragStop`                                            | handlers, or undefined when read-only                               |
| `onBeforeDelete`                                                                                | drops trigger nodes from deletion                                   |
| `onNodesDelete`                                                                                 | `ops.remove(id)` each                                               |
| `defaultEdgeOptions`                                                                            | `DEFAULT_EDGE_OPTIONS`                                              |
| `nodesDraggable`, `nodesConnectable`, `edgesFocusable`, `elementsSelectable`, `selectionOnDrag` | `!readOnly`                                                         |
| `isValidConnection`, `onConnect`                                                                | from `useCanvasConnect`                                             |
| `connectionLineType`                                                                            | `SmoothStep`; `connectionRadius={28}`; `connectionLineStyle`        |
| `deleteKeyCode`                                                                                 | `null` (deletion handled by `useCanvasKeys`)                        |
| `panOnDrag`                                                                                     | `true` when read-only, else `[1, 2]` (middle/right mouse)           |
| `panOnScroll`                                                                                   | true; `zoomOnScroll={false}`                                        |
| `selectionMode`                                                                                 | `Partial`                                                           |
| `onSelectionChange`                                                                             | keep `settingsId` only if still selected, else null                 |
| `onPaneContextMenu`                                                                             | preventDefault                                                      |
| `defaultViewport`                                                                               | `layout.viewport ?? { x: 120, y: 150, zoom: 0.7 }`; `minZoom={0.2}` |
| `proOptions`                                                                                    | `{ hideAttribution: true }`                                         |

- Child `CanvasChrome`. After ReactFlow, when `runId && logNode`: `CanvasNodeLogs`.

### CanvasChrome

- `Background variant=Dots gap={24} color="var(--muted-foreground)"`.
- `NodeSettings` (keyed by node id) when `editing`; LLM nodes get the system prompt field (`onSystemPrompt → system.save(id, text)`).
- `RunBar value = readOnly ? runView : "draft"`.
- `CanvasToolbar` only when not read-only; `hasTrigger` = any trigger node.

### CanvasToolbar

`Panel position="bottom-center"` → `div.flex.items-center.gap-2.rounded-3xl.bg-card.p-2.ring-1.ring-foreground/10 data-testid="workflow-canvas-toolbar"`:
ghost icon Buttons **Undo** (`workflow-canvas-undo`, `Undo2`, disabled `!canUndo`), **Redo** (`workflow-canvas-redo`, `Redo2`), **Fit view** (`workflow-canvas-fit`, `Scan`, `fitView({ maxZoom: 0.8, duration: 200 })`), then `AddNodeMenu`.

### AddNodeMenu

Popover (`side="top" align="end" className="w-64 gap-2 p-2"`); trigger Button `flow-add-node` (`Plus`) **Add node**.
Search `InputGroup` with `Search` addon, placeholder **Search nodes**, `flow-add-node-search` (case-insensitive substring on labels; empty groups hidden).
Per group: `span.px-2.pt-1.text-xs.text-muted-foreground` title, then ghost `justify-start` Buttons `flow-add-kind-<kind>` with the label. Trigger is disabled when one exists and shows right-aligned xs muted **one only**. Pick closes, clears search, calls `onPick(kind)`.

### RunBar

Props: `runs, cards, value, cardId, onValue, onCard, onStart, viewing: RunSummary|null, starting?`.
`Panel position="top-right" className="m-2 max-w-4xl"` → `div.flex.flex-wrap.items-center.gap-2.rounded-3xl.bg-card.p-2.ring-1.ring-foreground/10 data-testid="flow-run-bar"`:

- Run `Select` (`min-w-56`, `aria-label="Run"`, `flow-run-select`). Options: `draft` **Draft (editing)**, then each run `#<runs.length − i> · <card title | "No card"> · <status label>` (status from `statusOf`).
- When viewing a run: `div[data-testid="flow-run-banner"]` (`flex flex-wrap items-center gap-2 px-1 text-sm`): `StatusPill`, `font-medium` card title or **No card**, muted `done/total · <RelativeTime startedAt>`, optional `Badge outline` `itemKey`, xs muted **Read-only**.
- Else: card `Select` (`min-w-48`, `aria-label="Card"`, `flow-run-card`, placeholder **Run for a card…**) + Button `flow-start-run` (`Play`) **Start run** (disabled without card or while starting). Starting switches the view to the new run.

### NodeSettings

`Panel position="top-right" style={{ top: 64 }}` → `div.flex.w-80.flex-col.gap-4.overflow-y-auto.rounded-3xl.bg-card.p-4.ring-1.ring-foreground/10` with `maxHeight: calc(100vh - 14rem)`, `data-testid="node-settings"`.
Header: `h2.font-heading.text-base.font-medium` **<Kind label> settings**, xs muted truncated node id, ghost icon **Close settings** (`node-settings-close`, `X`).
Body by kind:

| Kind           | Fields                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| llm            | `SystemPromptField` (when handler), `StepLimits`, `AllowLists`         |
| agent          | `StepLimits`, `AllowLists`                                             |
| judge, command | `StepLimits`                                                           |
| other          | `p.text-sm.text-muted-foreground` **No extra settings for this kind.** |

Fields (`node-settings-fields.tsx`):

- `Choice({label, value, options, onChange, testId})`: `Field` + `FieldLabel` + `Select`.
- `StepLimits`: **Time limit** (`node-settings-timeout`; 1/5/15/30/60 → "N min"; value = `round(timeout/60)` min ≥1, default `15`; writes `timeout: minutes*60`) and **If it fails** (`node-settings-retry`; 0 **No retry**, 1 **1 retry**, 2/3 **N retries**; value from `retry.max` default `0`; writes `retry: undefined | {max}`).
- `AllowLists`: `Separator.my-1`, then sections (`h3.text-sm.font-medium` + xs muted hint): **Connectors** / **Systems this step may read or change.** with `ConnectorList`; **Skills** / **Instructions the step may follow.** with `SkillList`. Empty lists write `undefined`.
- `SystemPromptField`: **System prompt** `Textarea rows=4` placeholder **Optional: how the model should behave**, `node-settings-system-prompt`; each change saves immediately via `useSystemPrompt.save`.

### StepConnectors

- `ConnectorCount({id, connectors, skills, children})`: `button.nodrag` (`step-connectors`) opening settings, containing two `Badge secondary`: `Plug` **No connectors** / **1 connector** / **N connectors**; `Sparkles` (`step-skills-count`) **No skills** / **1 skill** / **N skills**; then `children` (logs button).
- `ConnectorList`: `MultiPick` over `connector/list` items (`value: id`, `label: name`, `hint: transport`), label **Connectors**, placeholder **Search connectors**, empty **No connector matches**.
- `SkillList`: `MultiPick` over `skill/list` items without `problem`, deduped by slug (`value/label: slug`, `hint: dirs.join(", ")`), label **Skills**, placeholder **Search skills**, empty **No skill matches**.

### MultiPick

Props `options: {value,label,hint}[], value: string[], onChange, label, placeholder, empty`. `Combobox multiple` with `ComboboxChips` (`nodrag`, `data-testid="pick-<label>"`), `ComboboxChip` per selected, `ComboboxChipsInput aria-label=label` (placeholder only when empty); `ComboboxContent anchor` with empty text and items (`data-testid="pick-item-<value>"`) showing label over xs muted hint.

### ModelRow

`div.-mx-2.flex.items-center.gap-0.5 data-testid="model-row"` with three borderless selects (`nodrag border-transparent bg-transparent px-2 shadow-none hover:bg-background/60 dark:bg-transparent`, items aligned not with trigger):

- **CLI** (`model-row-cli`): Claude / Cursor; value `cursor` or `claude`.
- **Model** (`model-row-model`, grows): Default / Sonnet / Opus / Haiku (values `default|sonnet|opus|haiku`); `default` writes `model: undefined`.
- **Effort** (`model-row-effort`): Default + `EFFORTS` (`low, medium, high, xhigh, max`) capitalized; default writes `effort: undefined`.

## Node cards

### NodeShell

Props: `kind, name?, selected?, wide?, state?, result?, children`.

- Root `div.group/node.flex.flex-col.gap-1.5` + `w-96` (wide) or `w-72` + `opacity-40` when skipped; `data-selected`, `data-testid="canvas-node-<kind>"`.
- `NodeToolbar` (`isVisible=selected`, `Position.Top`, offset 8, `!z-50`) when editable and not trigger: `div.flex.gap-1.rounded-2xl.bg-card.p-1.ring-1.ring-foreground/10` with ghost icon Buttons: **Node settings** (`node-open-settings`, `Settings2`, only kinds in `HAS_SETTINGS`), **Duplicate node** (`node-duplicate`, `Copy`), **Delete node** (`node-delete`, `Trash2`).
- Label row `flex min-h-6 items-center gap-1.5 px-1 text-xs text-muted-foreground`: kind icon `size-3.5`; name in `text-foreground` + ` · <Kind>` or just the kind label; right side `StatusPill` for state (running → working **Running**; done → **Done**; failed → **Failed**; waiting → attention **Needs you**) or plain **Skipped**.
- Body `relative flex flex-col gap-2 rounded-3xl bg-card p-2 ring-1 ring-foreground/10` + state ring (`ring-2 ring-info/50` running, `ring-destructive/60` failed, `ring-warning/60` waiting) + `ring-2 ring-ring` when selected. Contains children then `NodeRunFooter`.
- `FIELD = "rounded-2xl bg-muted/60 p-3"`.

### Ports (`NodePorts.tsx`)

- `PortHandle({io, port="text", id?, index=0, count=1, inset=0})`: React Flow `Handle` (`target` left for in, `source` right for out), id = `id ?? port`, `title` **Text in** / **Files out** etc., style `top: (index+1)*100/(count+1)%` and `left|right: -inset`. Classes: `z-10 flex size-5! items-center justify-center rounded-full! border-0! bg-card! ring-1 transition-transform hover:scale-125` + `PORT_STYLE[port]` (`text-info ring-info/50`, file `text-warning ring-warning/50`, any `text-foreground ring-foreground/30`) + linked fill (`bg-info/20!`, `bg-warning/20!`, `bg-muted!`) when `useNodeConnections` reports a wire. Icon `size-2.5`: `Type` text, `File` file, `Plus` any.
- `KindPorts({ins, outs})`: one handle per port spread along each edge.

### Per-kind renderers

| Node                         | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TriggerNode`                | Ports; `FIELD` row `flex items-center gap-2 text-sm font-medium` with `MousePointerClick size-4 text-warning` + **Start by hand**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PromptNode` (wide)          | Ports; `NodeFileField file="text.md" label="Prompt text" placeholder="Write the text this prompt passes on" rows=4`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `LlmNode` (wide; also agent) | Ports; `NodeFileField file="prompt.md" label="Instructions" placeholder="What should the model do with its inputs?" rows=4`; `ModelRow` (editable only); `ConnectorCount` containing `NodeLogsButton`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `CommandNode` (wide)         | Ports; `NodeYamlField label="Command" placeholder="echo ok" rows=2 mono testId="node-field-run"` → `update({run})` only when non-empty                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `JudgeNode` (wide)           | In ports only (branch outs below). Rule mode: `NodeFileField file="rule.md" label="Rule" placeholder="Answer yes when…" rows=3` + `ModelRow` (editable); check mode: `FIELD` muted **Checks an upstream answer**. Then two rows **Yes** / **No** (`relative rounded-2xl bg-muted/60 px-3 py-2 text-sm`, `ring-1 ring-success/40` on the taken branch) each with an out `PortHandle id="yes"                                                                                                                                                                                                                                                                                                                                      | "no" inset=8`. Result text hidden when it is `yes`/`no` |
| `AssetNode` (wide)           | Ports; read-only → `FIELD` text of item labels joined `, ` or **No library items**; else `MultiPick` over `library/list` (`value: id`, `label: title`, `hint: "<kind> · v<current>"`, label **Library items**, placeholder **Pick library items** or **Library is empty**, empty **No library item matches**) → `update({items: next or undefined})`                                                                                                                                                                                                                                                                                                                                                                             |
| `ApprovalNode`               | Ports; `NodeYamlField label="Question" placeholder="Continue?" rows=2 testId="node-field-question"` → `{question: v                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                         | "Continue?"}` |
| `OutputNode`                 | Ports. Legacy target (`folder`/`publish`): `FIELD` row **Run folder output is retired** / **Publish output is retired** + outline `nodrag` Button `output-use-notify` **Notify instead** → `{target:"notify", connection: undefined, latest: undefined}`. Else a radiogroup (`aria-label="Notification"`, `nodrag grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1`) of two `role="radio"` Buttons `output-channel-app` (`Bell`) **In the app** and `output-channel-system` (`MonitorSmartphone`) **System** (selected: `secondary` + `bg-card ring-1 ring-foreground/10`; app writes `channel: undefined`), then `NodeYamlField label="Title" placeholder="Notification title" rows=1 testId="node-field-title"` → `{title: v |                                                         | undefined}`   |

### NodeFields

- Shared textarea class: `nodrag nowheel nopan block w-full resize-none rounded-2xl bg-muted/60 px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default` (+ `font-mono text-xs` when mono). Disabled when read-only. `spellCheck=!mono`. KeyDown stops propagation (canvas keys don't fire).
- `NodeFileField({nodeId, file, label, placeholder, rows})`: `useNodeFile(workflows/<wf>/nodes/<id>/<file>)`; placeholder **Loading…** until loaded; `data-testid="node-field-<file without .md>"` (`node-field-prompt`, `node-field-rule`, `node-field-text`).
- `NodeYamlField({value, label, placeholder, rows, mono, testId, onCommit})`: local draft resynced when `value` changes; on blur commits `draft.trim()` only if different from `value.trim()` (one undo step per edit).

### useNodeFile(path)

Returns `{ text, loaded, change(next), flush() }`. Loads once via `file/read_text` (keeps `hash`; missing file → empty text). `change` sets text and schedules `flush` after 400 ms. `flush` writes `file/write_text {path, text, baseHash?}`; on failure drops the base hash and keeps the pending text (next write overwrites). Flushes on unmount.

### NodeRunFooter

Props `kind, nodeId, state?, result?, onRetry?`. In order:

1. `NodeInboxPrompt` when `inbox[nodeId]` exists.
2. Result box `FIELD nowheel max-h-28 overflow-auto text-xs text-muted-foreground`, `data-testid="node-result-<id>"`.
3. When failed and retry available: outline Button `node-retry-<id>` (`nodrag nopan pointer-events-auto w-fit`, `RotateCcw`) **Retry**.
4. For kinds other than llm/agent: `div.flex` with `NodeLogsButton`.

### NodeInboxPrompt

`NodeInboxItem = Exclude<WireInboxItem, {kind:"sign_in"}>`.
`Item variant="outline" size="sm"` with `nodrag nopan nowheel pointer-events-auto flex-col items-stretch bg-warning/15 ring-warning/25`, `data-testid="node-inbox-<nodeId>"`: title = question; permission adds description **Tool: <tool>**.
Actions: approval → **Approve** (default, `Check`, `approved`), **Reject** (outline, `X`, `rejected`); permission → **Allow once** (default, `Check`), **Always allow** (outline), **Reject** (outline, `X`, `reject-once`); testids `node-inbox-<optionId>-<nodeId>`. Other kinds → link Button `node-inbox-open-<nodeId>` **Answer in Inbox** → `/inbox`. Errors other than conflict → `toast.error(message)`.

### NodeLogsButton

Visible only when `openLogs` exists (a run is followed) and `showsLogButton(kind, state)` (kinds command/llm/agent/judge with state running/done/failed). Ghost icon Button `nodrag nopan pointer-events-auto ml-auto shrink-0`, `aria-label`/`title` **View logs**, `data-testid="node-logs-<id>"`, icon `ScrollText`.

## FlowContext

```ts
export type FlowActions = {
  update(id, patch)
  run(id)
  runAll()
  workflowId?: string
  readOnly: boolean
  duplicate(id)
  openSettings(id)
  remove(id)
  decide?(decision: "approved" | "rejected")
  retry?(id)
  openLogs?(id)
  inbox?: Readonly<Record<string, NodeInboxItem>>
}
```

Default value: no-ops with `readOnly: true`. `useCanvasActions` fills it:
`update/duplicate/remove` from ops, `run`/`runAll` no-ops, `readOnly` from
overlay, `retry` when the overlay has `onRetry`, `openLogs = setLogNodeId`
only when a run is followed, `inbox` from overlay. `openSettings(id)` sets
`settingsId` and loads `system.md` for llm nodes (clears otherwise).

## Hooks

### useCanvasOps(yaml, layout, workflow, onYamlChange, onLayoutChange, onRemoved?)

Keeps refs to latest yaml/layout/workflow. Returns:

- `update(id, patch)`: drops keys `kind`, `summary`, `state`, `result`; applies each remaining key with `setNodeKey` (undefined deletes).
- `remove(id)`: not for trigger; `removeNode(yaml, id)`; deletes layout entry; `onRemoved(id)`.
- `duplicate(id)`: not for trigger; `addNode(yaml, cloneNodeRecord(src, newId))`; layout at source `+40, +40`.
- `add(kind)`: refuse a second trigger; `addNode(yaml, defaultNode(kind, id))`; layout at last layout entry `+80, +120` (from 0,0).
- `connect(edge)`: `addEdge(yaml, edge)`.
- `disconnect(edges)`: `removeEdge` each; emits only if changed.

### useCanvasConnect

- `removeEdges(wires)`: map with `connectionToEdge` and `disconnect`.
- `isValidConnection(c)`: valid edge and not a duplicate of an existing edge with the same source/target/handles.
- `onConnect(c)`: `connect(connectionToEdge(c))` when valid.
- `onNodeDragStop(_, node, dragged)`: merge dragged positions; `resolveCollisions(nodes, { pinned: dragged ids + node })`; `setNodes`; publish layout `canvasToLayout(nodes, viewportRef.current ?? layout.viewport)`.

### resolveCollisions(nodes, { pinned?, margin = 24, maxIterations = 200 })

Boxes use `measured` size, else `width/height`, else 260×120. Repeated
pairwise passes: overlap `ox/oy` including margin; push along the axis of
least overlap, split 50/50 when both movable, all to the movable one
otherwise; pinned or `draggable === false` nodes never move. Returns the
same array when nothing moved; only moved nodes get new objects.

### useCanvasKeys(nodes, edges, duplicate, remove, removeEdges, enabled)

Window keydown, ignored inside `input, textarea, [contenteditable=true], [role='combobox']`.
Cmd/Ctrl+D duplicates selected nodes. Backspace/Delete removes selected edges then selected nodes (preventDefault only when something is selected).

### useEditorHistory(yaml, layout, apply, enabled)

History `{ list: EditorSnapshot[], at }` seeded with the initial snapshot.
Each change records a snapshot after a 350 ms debounce (skipped when equal
to the current one or right after an undo/redo apply); keeps the last 50;
truncates redo tail. `undo`/`redo` apply `list[at∓1]`. Keyboard: Cmd/Ctrl+Z
undo, Cmd/Ctrl+Shift+Z and Cmd/Ctrl+Y redo (ignored in inputs). Returns
`{ undo, redo, canUndo: at > 0, canRedo: at < len − 1 }`.

### useRunOverlay(workflowId, nodes, view, setView)

- Queries: `run/list {workflowId, limit:100}`, `docket/list_cards {}`, `inbox/list {}`.
- `runId = view === "draft" ? null : view`; `useCanvasRun(runId)`.
- `inbox`: map nodeId → first open, non-sign-in inbox item with `runId` equal to the followed run.
- `viewing = summary ?? runs.find(runId) ?? null`.
- `shown`: in draft returns nodes as is. When following a run each node gets `selectable: false`, `draggable: false`, `className: "pointer-events-none"` unless interactive (failed, logs button shown, or has an inbox ask), and data merged with `state`, `result`, `failReason`, `attempt`, `pass`, `passes`.
- `start()`: `startRun({workflowId, cardId})` → `setView(runId)` (URL `?run=`).
- Returns `{ shown, inbox, runs, cards, cardId, setCardId, viewing, starting, start, onRetry, runId, readOnly: !!runId }`.

### useCanvasRun(runId)

- Cache `{ runId, steps, results: Record<nodeId, string>, summary }`.
- On runId: `run/get {id}` → steps + summary.
- Subscribes to `run:<runId>` (`run:__none__` when null). `step_state` upserts a step by `(nodeId, pass)`; `run_changed` / `run_finished` set summary and refetch `run/get`.
- For each succeeded/failed step that is the latest pass of its node, fetch log text once per `runId:nodeId:pass:attempt:status`: failed reads `stderr` then `stdout`, else `stdout`; first non-empty trimmed text, cut to 600 chars + `…`; stored as `results[nodeId]`.
- `views` = `statesFromSteps(steps)` with `result` overridden by fetched log text.
- Returns `{ summary, views, onRetry?: (nodeId) => retryStep(...), runId, loading }`.

### node-run-view.ts

`TaskStatus → RunState`: pending → none; awaiting_approval → waiting; running → running; succeeded → done; failed → failed; skipped → skipped; cancelled → failed.
`statesFromSteps(steps)`: sorted by pass; per node keeps the latest pass: `{ state, attempts: max(1, attempts), pass, passes (deduped by pass, oldest first), failReason?, result?: branch ?? decision ?? failReason }`.

### useSystemPrompt(workflowId)

`{ text, load(nodeId), clear(), save(nodeId, text) }` on `workflows/<wf>/nodes/<id>/system.md` (read with hash; save writes with `baseHash` when known; errors ignored).

## Node logs Sheet

### node-logs.ts

- `showsLogButton(kind, state)`: kind in {command, llm, agent, judge} and state in {running, done, failed}.
- `parseTrace(text)` → `{ error, frames }`: frames are lines matching `/^\s+at\s/` (trimmed); error is the other non-empty lines joined, or the whole text.
- `LogEntry = { at, id?, kind: "command"|"tool_call"|"message"|"error", title, command?, status?, text? }`.
- `parseEntries(ndjson)`: keep only the last line for each `"id"`; drop unparsable lines and those without string `at`/`title`; sort newest `at` first, ties by later line first.

### NodeLogDialog

Props: `runId, nodeId, nodeName, passes: {pass, attempts}[], failReason?, onClose`.

- Pass = picked or latest; attempt = that pass's attempts.
- Loads `stdout`, `stderr`, `events` in parallel, each up to 16 chunks from offset 0 following `nextOffset` until `eof`.
- `Sheet open` `SheetContent side="right" className="flex max-h-dvh flex-col gap-3 data-[side=right]:sm:max-w-lg" data-testid="node-log-dialog"`:
  - Header (`pr-12`): title **<nodeName> logs**; description `Pass <p> · ` (only when >1 pass) + `Attempt <n>`.
  - Pass tabs (when >1): `div.flex.flex-wrap.gap-1.px-4 role="tablist" aria-label="Pass" data-testid="node-log-passes"`, Buttons `role="tab"` (`secondary` selected else ghost) `node-log-pass-<n>` **Pass <n>**; picking resets to loading.
  - Body `flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pb-4`: loading `NodeLogLoading`; error `p.text-destructive data-testid="node-log-error"` (message or **Logs unavailable**); entries → `NodeLogEntries`; else `StackTrace` (`node-log-trace`) from `stderr || failReason` and `Output` of stdout (`node-log-stdout`); empty → `p.text-muted-foreground data-testid="node-log-empty"` **No output yet.**
- `CanvasNodeLogs({runId, node, onClose})`: name = `data.name ?? data.kind`; passes = `data.passes ?? [{pass: data.pass ?? 1, attempts: data.attempt ?? 1}]`.

### NodeLogEntries

- `Output({text, testId?})`: `pre.max-h-96.overflow-auto.rounded-md.bg-muted.p-3.text-xs.break-words.whitespace-pre-wrap.font-mono`.
- `NodeLogLoading`: `ol[data-testid="node-log-loading"]` with 3 items (`Skeleton ml-1 h-3 w-24` over `h-12 w-full`).
- `NodeLogEntries({entries})`: `ol.flex.flex-col.gap-2 data-testid="node-log-entries"`; each `li[data-testid="node-log-entry-<kind>"]` with a meta line (`<time>` `formatAbsolute(at)` + status) and a body:
  - error with text → `StackTrace` (`node-log-trace`).
  - has `command` → `Terminal title=command output=text||"(no output)" status defaultOpen data-testid="node-log-terminal"` (status `failed` → `error`; `running|in_progress|pending` → `running`).
  - else `Trace` (`node-log-tool`) with a `TraceCollapsible` (open by default for messages) whose trigger is a `TraceLine` (status error only) with `TraceIcon` (`MessageSquareIcon` for message, `WrenchIcon` otherwise) and `TraceTitle`; content `Output` when text.
