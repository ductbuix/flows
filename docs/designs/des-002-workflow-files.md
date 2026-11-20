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
      graph.json              # frozen graph plus spawned tasks
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
    prompt: Read input/topic.md and plan the research.
    memory: [memory/style.md]
    spawn: true
    retry: { max: 2 }
  - id: fetch
    kind: command
    run: node scripts/fetch.js
    needs: [plan]
    matrix: { source: [web, papers, news] }
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
```

The visual editor and `workflow.yaml` stay in sync; the file is the source
of truth.

## App home

The app home is `~/.flowapp`. `FLOWAPP_HOME` overrides it, so tests and
e2e runs use a temporary directory and never touch the user's data.

## Task environment

Tasks read upstream outputs by path. Env: `UPSTREAM_<taskId>`, `TASK_IN`,
`TASK_OUT`, `PREV_ATTEMPT`, `WF_DIR`, `WF_INPUT`, `WF_OUTPUT`, `RUN_ID`.
