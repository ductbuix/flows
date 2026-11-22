---
id: DES-033
title: Workflow file v2, node files and layout file
type: design
status: draft
summary: "workflow.yaml v2: nodes and edges with ports and branches, fixed node files, and a layout file keyed by node id."
tags: [design, yaml, workflow, nodes, layout, storage]
related: [DES-031, DES-032, DES-034, DES-002, DES-013, DES-020, DES-021]
updated: 2026-11-22
---

# Workflow file v2, node files and layout file

`workflow.yaml` stays the source of truth. It lists nodes and edges.
Long text lives in fixed files per node. Positions live in a separate
layout file, so moving a node never changes `workflow.yaml`.

## Folder layout

```
~/.flowapp/workflows/<workflowId>/
  workflow.yaml          # source of truth, version 2
  workflow.layout.json   # node positions and viewport (editor only)
  nodes/<nodeId>/        # prompt.md, system.md, text.md, rule.md
  nodes/.trash/<id>-<stamp>/   # removed node folders (as DES-022)
  memory/*.md  input/  output/  .cache/
  runs/<runId>/
    graph.json  layout.json    # frozen at start
    input/  resources/  work/  changes/
    nodes/<nodeId>/pass-<p>/attempt-<n>/
      input/text.md  input/files/<fromNodeId> -> ...
      out/  SUMMARY.md  stdout.log  stderr.log
```

`tasks/` becomes `nodes/`; there are no old workflows to keep
(DES-031 decision 10).

## Sample workflow

```yaml
id: story-fix
name: Fix a story
version: 2
goal: Draft a fix for a story, review it, and open a draft PR
limits: { concurrency: 3, agents: 2, maxConcurrentRuns: 1, loopPasses: 5 }
timeout: 900
agent:
  cursor: { model: gpt-5, effort: high }
nodes:
  - id: node-1a2b3c4d
    kind: trigger
    name: Start
    type: manual
    inputs:
      - { name: story, type: markdown, required: true }
  - id: node-2b3c4d5e
    kind: asset
    name: API repo and spec pages
    access: propose
    resources:
      - { connection: github-acme, entity: repo, id: acme/api }
      - { connection: confluence-eng, entity: page, id: "123456" }
  - id: node-3c4d5e6f
    kind: prompt
    name: House rules # text in nodes/node-3c4d5e6f/text.md
  - id: node-4d5e6f70
    kind: agent
    name: Draft fix # task in nodes/node-4d5e6f70/prompt.md
    cli: cursor
    memory: [memory/style.md]
    answers:
      - { name: risk, type: choice, labels: [low, high] }
    retry: { max: 1 }
  - id: node-5e6f7081
    kind: judge
    name: Tests pass?
    mode: rule # instructions in nodes/node-5e6f7081/rule.md
    cli: claude
    effort: medium
  - id: node-6f708192
    kind: approval
    name: Ok to publish?
    question: "Risk is {{risk}}. Open the draft PR?"
  - id: node-708192a3
    kind: output
    name: Draft PR
    target: publish
    connection: github-acme
  - id: node-8192a3b4
    kind: output
    name: Notes
    target: folder
edges:
  - { from: node-1a2b3c4d, to: node-4d5e6f70 }
  - { from: node-2b3c4d5e, to: node-4d5e6f70, port: file }
  - { from: node-3c4d5e6f, to: node-4d5e6f70 }
  - { from: node-4d5e6f70, to: node-5e6f7081 }
  - { from: node-5e6f7081, to: node-6f708192, branch: yes }
  - { from: node-5e6f7081, to: node-4d5e6f70, branch: no } # loop back
  - { from: node-6f708192, to: node-708192a3 }
  - { from: node-4d5e6f70, to: node-8192a3b4, port: file }
```

## Top-level keys

| Key       | Meaning                                                      |
| --------- | ------------------------------------------------------------ |
| `id`      | folder name and stable key, as today                         |
| `name`    | optional display label (BL-073)                              |
| `version` | `2`; a file without it is rejected with a clear message      |
| `goal`    | free text                                                    |
| `limits`  | concurrency, agents, maxConcurrentRuns, and new `loopPasses` |
| `timeout` | default per attempt seconds (DES-019)                        |
| `agent`   | per-CLI model and effort defaults (DES-023)                  |
| `nodes`   | list of nodes; each kind's keys come from its registry entry |
| `edges`   | list of `{ from, to, port?, branch? }`                       |

Removed with no alias: `tasks`, `inputs` (now on Trigger), `needs`,
`when`, `repeat`, `approval`, `continueOnError`, `spawn`, `uses`,
`maxTasks`, `maxSpawnDepth`, `kind: publish`, and the judge slots
`when.md`, `until.md`, `need-<id>.md`.

## Edges

- `port` is `text` (default) or `file`. It must be an out port of the
  source kind and an in port of the target kind (DES-032 table).
- `branch` is required on edges out of a Judge and not allowed
  elsewhere. `yes` and `no` are plain strings under YAML 1.2, which
  the `yaml` package parses by default; quoting them is also fine.
- No edge ids in YAML: `from`, `to`, `port` and `branch` together are
  the key, and a duplicate is a validation error (OpenBot's
  `workflowGraphProblem` "duplicate" rule).
- A cycle is allowed; DES-034 says which edge is the loop edge.
- File order of edges into a node is the order of its inputs.

## Node files

| Kind   | Files                             |
| ------ | --------------------------------- |
| prompt | `text.md`                         |
| agent  | `prompt.md`                       |
| llm    | `prompt.md`, optional `system.md` |
| judge  | `rule.md` (rule mode)             |

Paths are fixed and derived, with no key in YAML (DES-020 rule kept).
Short text (Approval `question`, Output `title`) stays inline.

## Layout file

`workflow.layout.json`, written by the server, read by the editor
only:

```json
{
  "version": 1,
  "nodes": { "node-1a2b3c4d": { "x": 0, "y": 160 } },
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

- Every node position is saved, as OpenBot saves `x` and `y` per node
  (`workflow_nodes` in `src/backend/migrations/0046-workflows.ts`).
  OpenBot keeps them in the same database row as the node; flows keeps
  them in a sidecar so `workflow.yaml` diffs show only real changes,
  hand and agent edits never touch coordinates, and comment-keeping
  writes stay simple.
- A node with no position (added by hand or in the YAML pane) is placed
  by dagre next to its inputs, then saved on the next layout write.
- Positions of ids that no longer exist are dropped on save. A rename
  of an id moves its position in the same save.
- The engine never reads it. Loop edges do not depend on positions
  (DES-034), unlike OpenBot, which breaks ties by top-left position.
- Run start copies it to `runs/<runId>/layout.json`, so the run
  history shows the canvas as it was.

## Validation

- At least one Trigger. Ids unique and safe as folder names.
- Every edge passes the port table; Judge edges carry a branch.
- Up to 200 nodes and 400 edges, as OpenBot `INPUT_LIMITS`.
- Required node files exist (pre-run check, as DES-020).
- `{{name}}` resolves to exactly one upstream answer.
- A cycle with no Judge on it is a warning: it runs until the loop
  limit.
- An Output with `target: publish` needs an Asset with `access:
propose` on that connection upstream (DES-026 rule, moved).

## Writes

- Canvas and Sheet edits go through the shared YAML edit helpers, which
  keep comments and key order (DES-013). New helpers: add, remove and
  rename a node, set a node key, add and remove an edge.
- PUT diffs node ids, as PUT diffs task ids today (DES-022): a removed
  node's folder moves to `nodes/.trash/`.
- Layout writes are a separate request, debounced, and never touch the
  YAML. They do not mark the editor dirty.
- A save names the YAML revision it started from; a stale editor gets
  the conflict dialog, as today.

## Existing data

pootato deletes old workflows himself. A v1 file is not migrated: the
list shows it as "Old format" with Delete only. Old runs are covered in
DES-034.
