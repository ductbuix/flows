---
id: DES-036
title: Canvas editor and run view for nodes
type: ui
status: draft
summary: Canvas-first editor with a teaching empty state, Add node menu, settings and results on nodes, run history, sized by DES-027.
tags: [ui, web, editor, canvas, runs, nodes]
related:
  [DES-031, DES-032, DES-035, DES-027, DES-028, DES-029, DES-030, DES-010]
updated: 2026-11-22
---

# Canvas editor and run view for nodes

The editor opens on the canvas. What made OpenBot clear on first visit
is copied as behavior, with flows' own words and shadcn base-nova
parts. Every size comes from the DES-027 spec sheet; graph nodes are a
dense container there, so controls inside a node may be `sm` (28px).

## Editor frame

```
| title block + Tabs (Overview, Editor, Runs)                           |
| [Graph|YAML]  [undo][redo]  [Settings] [Add node v] [Run v] [Save]    |
|-----------------------------------------------------------------------|
| canvas, full bleed, fills the height                  [run history]   |
| [- + fit] bottom-left                                                 |
```

- The frame from BL-065 stays: `PageToolbar`, 32px controls, full
  bleed canvas and YAML pane below a `border-t`, Save with ⌘S, YAML
  errors as one destructive `Alert`, `fitView` with `maxZoom: 1`.
- "Add task" becomes "Add node" (below). "Run" (default) starts a run
  from the first Trigger; its menu has "Run from selected node".
- The YAML tab stays a fixed tab (DES-027 decision); it shows
  `workflow.yaml` only, never the layout file.

## Empty state

A new workflow shows a page `Empty` (no border, centered) with a small
static diagram (Trigger, then Agent, then Output, as three `Card
size="sm"` blocks with lines), three short lines of our own copy and
two buttons (32px): "Add a trigger" (default) and "Start from a
sample" (`outline`). The sample adds Trigger, Agent and Output, wired.
OpenBot does the same in `WorkflowsEmpty.tsx`; we write our own text.

## Add node menu

- Toolbar "Add node" (`outline`) opens a `Popover` with a `Command`
  list: search input, then groups Inputs (Trigger, Prompt, Asset),
  Steps (Agent, Command, LLM), Flow (Judge, Approval, Output), each
  with its icon. The list comes from the registry (DES-035).
- Dragging a wire from a port and dropping it on empty canvas opens the
  same list titled "Add a connected node", filtered to kinds whose in
  port matches, and wires the new node.
- A new node lands at the drop point or next to the selection, and its
  position is saved.

## Nodes

| Part        | Rule                                                                     | px          |
| ----------- | ------------------------------------------------------------------------ | ----------- |
| Card        | `Card size="sm"`; steps `w-72`, inputs and flow `w-60`                   | 288 or 240  |
| Header      | kind icon, name `text-sm font-medium`, Run step `icon-sm` button         | 28 controls |
| Body        | the kind's `Body`: pills and one Textarea, `min-h-16`                    | 64 min      |
| Pills       | CLI and model as `InputGroupAddon` buttons with Model Selector           | 28          |
| Ports       | React Flow `Handle`, one per port, labelled on hover                     | 10          |
| Judge ports | Yes and No handles on the right, with small text labels                  | 10          |
| Selected    | `ring-2 ring-ring`                                                       | -           |
| Status      | `Badge` in the header: running (Spinner), waiting, done, failed, skipped | 20          |
| Timer       | `text-xs tabular-nums` next to the badge while running and after         | -           |
| Result      | collapsed `CodeBlock size="sm"`, `max-h-32`, "Open" to the step tab      | 128 max     |
| Retry       | `outline` `sm` button in the result row when failed                      | 28          |

- Settings that fit go on the node: the task, rule, question or text,
  CLI, model and effort, Output target, Asset chips.
- The rest opens in the node Sheet (384px, DES-027): name, timeout,
  retry, memory files, named answers, Asset access, Output target
  fields, Delete node.
- Nodes are dragged freely; positions save on drag end (debounced)
  without marking the editor dirty.
- Loop edges draw as a curve with a loop `Badge`; Judge edges show
  "Yes" or "No" on the line.
- A bad wire is refused with a toast that says why (port type, branch,
  duplicate), as OpenBot's board refusals do.

## Run on the canvas

- Run step on a node runs that node alone with the latest upstream
  results (DES-034 partial runs).
- During a run the editor follows the live run over the websocket:
  each node shows its status, timer and result, and its pass count
  after a loop.
- Run history: a `Card` in the canvas corner (bottom right, `w-72`)
  lists recent runs as `Item size="xs"` rows (run label, status,
  relative time). Picking one shows the canvas as that run saw it
  (frozen graph and layout) with its results, read-only, with a "Back
  to editing" button. It mirrors OpenBot's `WorkflowCanvasHud.tsx`.
- Approval nodes show Approve and Reject while waiting, besides the run
  view lead (DES-029).

## Workflow settings Sheet

Stays as BL-067 with one change: Inputs move to the Trigger node's
Sheet. The Accordion holds Name, goal and limits (with the loop limit),
Agent defaults and Memory files.

## Run view

The run view (DES-029, BL-062, BL-063) keeps its summary-first layout.
Changes:

- The task table becomes a step table: node name, kind icon, pass,
  attempt, status, duration. One row per pass; a loop shows rows
  "pass 1", "pass 2".
- The step detail tabs stay (Summary, Terminal, Files). A Judge step
  adds its verdict and the rule it read; an Approval step adds the decision and when it was made.
- The graph tab uses the run's frozen layout with the same node cards,
  read-only.
- The lead Alert or Confirmation covers waiting Approval steps.

## Test ids and evidence

- `data-testid`: `canvas`, `add-node`, `node-<id>`, `port-<id>-<port>`,
  `node-run-<id>`, `run-history`, `empty-sample`.
- Every UI backlog ships Playwright videos and light and dark
  screenshots of the changed screens, and updates the BL-061 layout
  baselines in the same change.

## Later

Decorative nodes (note, text, shape, drawing), groups, minimap and a
command palette entry for Add node (BL-072).
