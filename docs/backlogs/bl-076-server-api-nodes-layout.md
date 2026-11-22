---
id: BL-076
title: Server API for nodes, node files and the layout file
type: backlog
status: todo
summary: PUT and GET for v2 workflows, nodes/<id>/ files and trash, workflow.layout.json writes, Old format list rows.
tags: [server, api, nodes, layout]
related: [DES-033, DES-013, DES-022]
updated: 2026-11-22
priority: P0
depends: [BL-074]
---

# Server API for nodes, node files and the layout file

Design: [DES-033](../designs/des-033-workflow-file-v2.md) (Writes,
Layout file).

## Done when

- [ ] GET and PUT handle v2 files; PUT diffs node ids and moves a
      removed node's folder to `nodes/.trash/<id>-<stamp>/`.
- [ ] Node files are created from the kind's `files` list; a rename
      moves the folder and the layout entry in the same PUT.
- [ ] A layout endpoint reads and writes `workflow.layout.json`
      atomically, drops orphan ids, and never touches the YAML.
- [ ] Run start copies the YAML graph and the layout to the run folder.
- [ ] A v1 workflow lists as "Old format" with Delete only; opening it
      shows an Alert that says so.
- [ ] Server tests cover PUT, trash, rename, layout orphans and the old
      format row.
