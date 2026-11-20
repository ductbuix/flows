---
id: BL-016
title: Plain textarea for memory and instructions
type: backlog
status: done
summary: Edit memory and instructions in a plain textarea, and add a .md memory file with a file picker.
tags: [ui, web, editor, memory, files]
related: [DES-018, DES-013]
updated: 2026-11-21
priority: P1
depends: [BL-015]
---

# Plain textarea for memory and instructions

Design: [DES-018](../designs/des-018-agent-kind-and-file-editing.md).
Depends on [BL-015](bl-015-agent-kind.md) because **Edit instructions**
lives on the Inspector fields that only stay usable after a kind switch
produces a valid agent task.

## Done when

- [x] The memory editor uses a plain textarea (not CodeMirror), with
      explicit Save and Remove (confirm). Edits still apply to future
      runs only. The `baseHash` conflict check stays.
- [x] A native file picker adds a `.md` memory file through the
      existing PUT memory endpoint. On a name collision the user can
      overwrite or rename.
- [x] The Inspector has **Edit instructions** next to the path. It
      opens the same textarea dialog and creates the file if missing.
      The path is validated and stays inside the workflow dir.
- [x] The YAML pane keeps CodeMirror.
- [x] Unit tests cover the instructions file endpoints, including
      rejected traversal and the `baseHash` conflict.
- [x] Playwright tests from DES-018 for memory and instructions
      editing, with video and screenshots.
