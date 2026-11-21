---
id: DES-002
title: Folder layout and workflow file
type: design
status: active
summary: On-disk layout under ~/.flowapp, the workflow.yaml format, and the env vars tasks get.
tags: [storage, yaml, workflow, files]
related: [DES-001, DES-004, DES-005, DES-020]
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
    tasks/<taskId>/           # authored prompts and judge files (DES-020)
      prompt.md  when.md  until.md  need-<id>.md
    memory/*.md               # initial memories for agent tasks
    input/  output/  SUMMARY.md
    runs/<runId>/
      graph.json              # starting graph plus tasks spawned in this run
      tasks/<taskId>/         # this run's attempts, not the prompt folder
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
timeout: 900 # default per-attempt seconds; task timeout wins (DES-019)
tasks:
  - id: task-a1b2c3d4
    name: Plan
    kind: agent
    cli: claude # or cursor
    # prompt is tasks/task-a1b2c3d4/prompt.md (DES-020)
    memory: [memory/style.md]
    spawn: true
    timeout: 1800
    retry: { max: 2 }
  - id: task-b2c3d4e5
    name: Fetch
    kind: command
    run: node scripts/fetch.js
    needs: [task-a1b2c3d4]
  - id: task-c3d4e5f6
    name: Check
    kind: command
    run: python check.py
    needs: [task-b2c3d4e5]
    repeat:
      max: 5
      until:
        any:
          - expr: "json('out/score.json').score >= 0.8"
          - agent: { cli: claude } # reads tasks/task-c3d4e5f6/until.md
  - id: task-d4e5f607
    name: Publish
    kind: command
    run: cp -r $UPSTREAM_task_c3d4e5f6/out/* $WF_OUTPUT/
    needs: [task-c3d4e5f6]
    when: { exit: 0 }
    approval: true # wait for approval in the UI before running
  - id: task-e5f60718
    name: On fail
    kind: command
    run: echo failed
    needs:
      - task: task-c3d4e5f6
        when: { exit: 1 } # branch edge (DES-004)
```

The visual editor and `workflow.yaml` stay in sync; the file is the source
of truth. New task ids are generated as `task-` plus eight hex
characters, and `name` is the display label
([DES-020](des-020-fixed-prompt-files.md)). Legacy ids such as `plan`
still parse. Conditions, `when`, `retry`, `repeat` and branch edges:
[DES-004](des-004-conditions-loops.md).

## Task prompts

An agent task's prompt is always `tasks/<taskId>/prompt.md` in the
workflow folder. Agent judges use fixed files in the same folder,
named by slot (`when.md`, `until.md`, `need-<id>.md`). There is no
`instructions` key; the engine derives the path
([DES-020](des-020-fixed-prompt-files.md)). Command tasks have no
prompt file. No agent limits (turns, time, tokens, cost) are defined
yet; ledger entry in [DES-007](des-007-tradeoffs.md).

## App home

The app home is `~/.flowapp`. `FLOWAPP_HOME` overrides it, so tests and
e2e runs use a temporary directory and never touch the user's data.

## Task environment

Tasks read upstream outputs by path. Env: `UPSTREAM_*`, `TASK_IN`,
`TASK_INSTRUCTIONS`, `TASK_OUT`, `PREV_ATTEMPT`, `WF_DIR`,
`WF_INPUT`, `WF_OUTPUT`, `RUN_ID`. The `UPSTREAM_*` name is
`UPSTREAM_` plus the task id with every `-` replaced by `_`, because
a hyphen is not valid in a shell variable name (DES-020). For
`task-c3d4e5f6` the name is `UPSTREAM_task_c3d4e5f6`.
`TASK_INSTRUCTIONS` is set only for agent tasks, and is the absolute
path of `tasks/<taskId>/prompt.md` (or the stamped spawn `promptDir`
for a spawned task).
