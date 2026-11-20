---
id: DES-002
title: Folder layout and workflow file
type: design
status: active
summary: On-disk layout under ~/.flowapp, the workflow.yaml format, and the env vars tasks get.
tags: [storage, yaml, workflow, files]
related: [DES-001, DES-004, DES-005]
updated: 2026-11-21
---

# Folder layout and workflow file

## Folder layout

```
~/.flowapp/
  app.db
  config.yaml                 # global limits
  workflows/<workflowId>/
    workflow.yaml             # source of truth; editor reads and writes it
    memory/*.md               # initial memories for agent tasks
    input/  output/  SUMMARY.md
    runs/<runId>/
      graph.json              # starting graph plus tasks spawned in this run
      tasks/<taskId>/
        input/
        attempt-<n>/out/  attempt-<n>/SUMMARY.md  stdout.log  stderr.log
        latest -> attempt-<n>
```

A dir is the compacted context of its object. Each task writes its own
`SUMMARY.md`; the engine warns if it is missing.

## Workflow file

```yaml
id: research-report
goal: Produce a sourced report on input/topic.md
limits: { concurrency: 3, agents: 2, maxTasks: 50, maxSpawnDepth: 2 }
tasks:
  - id: plan
    kind: agent
    cli: claude # or cursor
    instructions: tasks/plan.md # user-written instructions for this task
    memory: [memory/style.md]
    spawn: true
    retry: { max: 2 }
  - id: fetch
    kind: command
    run: node scripts/fetch.js
    needs: [plan]
  - id: check
    kind: command
    run: python check.py
    needs: [fetch]
    repeat: { max: 5, until: { expr: "json('out/score.json').score >= 0.8" } }
  - id: publish
    kind: command
    run: cp -r $UPSTREAM_check/out/* $WF_OUTPUT/
    needs: [check]
    when: { exit: 0 }
    approval: true # wait for approval in the UI before running
```

The visual editor and `workflow.yaml` stay in sync; the file is the source
of truth.

## Task instructions

Each task can have its own instructions file, written by the user, set
with `instructions:` as a path relative to the workflow dir (any name or
folder). For an agent task it is the agent's prompt; a command task can
read it from `TASK_INSTRUCTIONS`. No agent limits (turns, time, tokens,
cost) are defined yet, in the file or in `workflow.yaml`; ledger entry in
[DES-007](des-007-tradeoffs.md).

## App home

The app home is `~/.flowapp`. `FLOWAPP_HOME` overrides it, so tests and
e2e runs use a temporary directory and never touch the user's data.

## Task environment

Tasks read upstream outputs by path. Env: `UPSTREAM_<taskId>`, `TASK_IN`, `TASK_INSTRUCTIONS`,
`TASK_OUT`, `PREV_ATTEMPT`, `WF_DIR`, `WF_INPUT`, `WF_OUTPUT`, `RUN_ID`.
