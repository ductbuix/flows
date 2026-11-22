---
id: DES-002
title: Folder layout and workflow file
type: design
status: active
summary: On-disk layout under ~/.flowapp, where the workflow format lives (DES-033), and the env vars steps get.
tags: [storage, yaml, workflow, files]
related:
  [
    DES-001,
    DES-004,
    DES-005,
    DES-020,
    DES-021,
    DES-022,
    DES-023,
    DES-027,
    BL-073,
    DES-031,
    DES-033,
    DES-034,
  ]
updated: 2026-11-22
---

# Folder layout and workflow file

## Folder layout

```
~/.flowapp/
  app.db                      # append-only event log (DES-003, DES-034)
  config.yaml                 # global limits
  workflows/<workflowId>/     # one folder per workflow (DES-033)
```

A workflow folder holds `workflow.yaml`, `workflow.layout.json`, one
`nodes/<nodeId>/` folder of fixed files per node, `memory/`, `input/`,
`output/`, `.cache/` and `runs/<runId>/`. The full tree is in
[DES-033](des-033-workflow-file.md).

A dir is the compacted context of its object. Each step writes its own
`SUMMARY.md`; the engine warns if it is missing.

## Workflow file

`workflow.yaml` is the source of truth; the canvas and the YAML pane
stay in sync with it. It lists `nodes` and `edges`. The node kinds are
in [DES-032](des-032-node-catalog.md); the format, node files, layout
file and validation are in [DES-033](des-033-workflow-file.md). The
node format replaced the task format in place (DES-031); there is no
version key and only one format.

The top-level `id` is the folder name and the stable key; the
optional `name` (1 to 80 characters) is only the display label, and the
UI falls back to the humanized id when it is absent
([DES-027](des-027-ui-renovation.md), BL-073). New node ids are
generated as `node-` plus eight hex characters.

## App home

The app home is `~/.flowapp`. `FLOWAPP_HOME` overrides it, so tests and
e2e runs use a temporary directory and never touch the user's data.

## Step environment

Steps read upstream outputs by path. The env names (`UPSTREAM_*`,
`NODE_IN`, `NODE_OUT`, `RUN_INPUT`, `RESOURCES_DIR`, `WF_DIR`,
`WF_INPUT`, `WF_OUTPUT`, `RUN_ID` and the rest) are in
[DES-034](des-034-node-engine.md) (Data passing). The `UPSTREAM_*`
name is `UPSTREAM_` plus the node id with every `-` replaced by `_`,
because a hyphen is not valid in a shell variable name. For
`node-4d5e6f70` the name is `UPSTREAM_node_4d5e6f70`.

Each attempt also gets a leased port block (`PORT`, `FLOWS_PORT_BASE`,
`FLOWS_PORT_COUNT`, default count 10) and package-cache dirs under
`<workflow>/.cache/` (`npm_config_cache`, `PNPM_STORE_DIR`,
`YARN_CACHE_FOLDER`, `XDG_CACHE_HOME`, `PIP_CACHE_DIR`) so parallel
copies and sandboxed installs do not clash (DES-026).
