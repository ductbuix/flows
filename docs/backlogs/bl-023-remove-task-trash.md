---
id: BL-023
title: Move removed task folders to tasks/.trash on save
type: backlog
status: todo
summary: On workflow PUT, derive removed task ids, block if a live or queued run still needs them, and move folders to tasks/.trash.
tags: [server, files, yaml, editor]
related: [DES-022, DES-013, DES-020, DES-021]
updated: 2026-11-21
priority: P0
depends: []
---

# Move removed task folders to tasks/.trash on save

Design: [DES-022](../designs/des-022-remove-task.md).

## Done when

- [ ] `isSafeTaskId` rejects any id that starts with `.`.
      `isAllowedWorkflowFilePath` rejects paths under `tasks/.trash/`.
- [ ] `writeWorkflowYaml` diffs task ids in the disk yaml against
      the new yaml. It does not take a client-sent list.
- [ ] If a removed id appears in a live or queued run's frozen
      graph as an authored task (no `promptDir`), the PUT returns
      409 `task_in_live_run` with `taskIds` and `runIds`, and
      writes nothing.
- [ ] After a successful yaml write, `tasks/<id>/` moves to
      `tasks/.trash/<id>-<YYYYMMDDTHHMMSSZ>/`. A name collision
      appends `-1`, `-2`, and so on. Missing folders are skipped.
      Leftover `tasks/<other>/need-<id>.md` files move to
      `from/<other>/need-<id>.md` inside that trash folder.
- [ ] A failed move after the yaml write returns 500 and names
      the path. The next save retries any leftover `tasks/<id>/`
      whose id is no longer in the yaml.
- [ ] Tests cover the allowlist and id rules, the move, a skip,
      a name suffix, leftover need files, the live 409, and the
      retry of a leftover folder.
