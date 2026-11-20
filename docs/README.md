---
id: DOC-001
title: Docs system
type: guide
status: active
summary: Layout, the one frontmatter schema, retrieval rules for agents, and how to add or change docs.
tags: [docs, meta, agents]
related: []
updated: 2026-11-20
---

# Docs system

## Layout

```
docs/
  INDEX.md          # root index (generated): sections and guides
  README.md         # this guide
  designs/
    INDEX.md        # generated table, one row per doc
    des-NNN-*.md    # system designs (type design) and UI instructions (type ui)
  backlogs/
    INDEX.md        # generated table, one row per item
    bl-NNN-*.md     # one chunk of work per file
```

`INDEX.md` files are generated from frontmatter. Never edit them by hand.

## Metadata schema

Every doc except `INDEX.md` starts with this frontmatter. It is plain YAML,
parsed with the `yaml` package and validated with a zod schema in
`packages/docs-tools/src/docs.ts`; unknown keys are errors. Quote a value
that contains `: ` (standard YAML), for example
`summary: "Engine: event log and scheduler"`.

| Key      | Required | Value                                                    |
| -------- | -------- | -------------------------------------------------------- |
| id       | all      | `DOC-NNN`, `DES-NNN` or `BL-NNN`; stable, never reused   |
| title    | all      | short title                                              |
| type     | all      | `guide` (docs root), `design` or `ui`, `backlog`         |
| status   | all      | see below                                                |
| summary  | all      | one line, max 140 chars; this is what indexes show       |
| tags     | all      | list, at least one, lowercase words                      |
| related  | all      | list of ids this doc builds on or links to; may be `[]`  |
| updated  | all      | `YYYY-MM-DD` of the last real content change             |
| priority | backlog  | `P0` (next), `P1` (soon), `P2` (later)                   |
| depends  | backlog  | list of backlog ids that must be done first; may be `[]` |

Status values:

- guide: `active`
- design and ui: `draft`, `active`, `deprecated`
- backlog: `todo`, `doing`, `blocked`, `done`

File names start with the lowercase id: `designs/des-003-engine.md`. The
one exception is this `README.md`.
Backlog bodies must have a `## Done when` section with checkable criteria.

Example:

```yaml
---
id: BL-004
title: Engine core
type: backlog
status: todo
summary: packages/engine with event log, scheduler and command tasks.
tags: [engine]
related: [DES-003]
updated: 2026-11-20
priority: P0
depends: [BL-001]
---
```

## Retrieval rules for agents

Read as little as possible, in this order:

1. `docs/INDEX.md` (tiny) to pick a section.
2. That section's `INDEX.md` to pick docs by id, status, summary and tags.
3. Only the docs you need. Follow `related` and `depends` ids one hop at a
   time, and only when the task needs them.

Shortcuts:

- Known id: `ls docs/*/des-003-*` or `rg -l '^id: DES-003' docs`.
- By tag: `rg -l '^tags: .*\bengine\b' docs`.
- Open work: the backlogs index, filtered on status `todo` or `doing`.
- Frontmatter only: read the first 12 lines of a doc.

Do not read whole folders, and do not read `INDEX.md` files and every doc
they list.

## Writing rules

- One topic per doc. Keep each file under 300 lines; split when it grows.
- Lead with the decision or rule, then the detail. No filler.
- Link other docs by relative path and list their ids in `related`.
- When code changes a design, update that doc and its `updated` date in
  the same change.
- Change backlog `status` as work moves. Done items stay as history.
- New id: next free number in the section. Never renumber.
- No secrets, tokens or personal data in docs.

## Commands

```sh
pnpm docs:index   # regenerate INDEX.md files from frontmatter
pnpm docs:check   # validate schema, ids, refs, links, 300 line limit, fresh indexes
```

`pnpm lint` also runs `docs:check`.
