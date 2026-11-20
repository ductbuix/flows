---
id: DES-012
title: "UI libraries: markdown, YAML editor, graph layout"
type: ui
status: active
summary: Chosen libs with measured sizes; react-markdown for SUMMARY.md, CodeMirror 6 for YAML, React Flow with dagre.
tags: [ui, web, libraries, markdown, editor, layout]
related: [DES-008, DES-009, DES-010, DES-007]
updated: 2026-11-21
---

# UI libraries: markdown, YAML editor, graph layout

Decisions for the libraries the run view ([DES-009](des-009-run-view.md))
and the editor ([DES-010](des-010-graph-editor.md)) need beyond shadcn.
Load the editor and graph code lazily, per route.

## How the numbers were measured

On 2026-11-21. "Bundle" is our own esbuild build (minified ESM, gzip -9,
React external) of the minimal import each option needs. "Weekly" is npm
downloads for the last week. "Published" is the npm registry `modified`
date.

## Markdown for `SUMMARY.md`

Decision: **`react-markdown` 10.1.0 + `remark-gfm` 4.0.1**, with fenced code
routed to the shadcn Code Block through `components.code` (the same wiring
the Code Block docs show for Streamdown).

| Option                      | Bundle (gz) | Weekly  | Published | Raw HTML by default                                          |
| --------------------------- | ----------- | ------- | --------- | ------------------------------------------------------------ |
| react-markdown + remark-gfm | 49 KB       | 61.6 M  | 2025-03   | escaped, not rendered                                        |
| streamdown 2.8.0            | 165 KB      | 12.4 M  | 2026-11   | rehype-raw, then sanitized and hardened                      |
| markdown-to-jsx 9.10.6      | 30 KB       | 6.1 M   | 2026-11   | parsed into JSX (`disableParsingRawHTML` defaults to false)  |
| marked 18.2.1               | 15 KB       | 137.7 M | 2026-11   | HTML string, needs `dangerouslySetInnerHTML` and a sanitizer |

Why:

- `SUMMARY.md` is written by tasks, including agents, so treat it as
  untrusted. react-markdown never renders raw HTML unless `rehype-raw` is
  added, and its default `urlTransform` drops unsafe URLs. Do not add
  `rehype-raw` or override `urlTransform`.
- GFM (tables, task lists, strikethrough, autolinks) comes from
  `remark-gfm`. Highlighting comes from Code Block (Shiki), which the UI
  already uses, so no second highlighter.
- AI Elements renders agent replies with Streamdown, built for markdown
  that is still streaming (it repairs unfinished syntax) and bundling
  Shiki, Mermaid and KaTeX plugins. `SUMMARY.md` is complete when we show
  it, so that is 3.4 times the size for features we do not use.
- Streamdown is a drop-in replacement for react-markdown, so switching
  later is cheap. Revisit trigger in DES-007.
- markdown-to-jsx is smaller but renders raw HTML unless configured;
  marked needs a sanitizer and raw HTML injection. Both are easier to get
  wrong.

## YAML editor for `workflow.yaml`

Decision: **CodeMirror 6** through `@uiw/react-codemirror` 4.25.12 with
`@codemirror/lang-yaml` 6.1.3 and `@codemirror/lint`. Use
`@codemirror/merge` for the diff in the file conflict dialog, and
`@codemirror/lang-markdown` for `memory/*.md`.

| Option                                    | Bundle (gz)                                                                      | Workers | Vite setup                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CodeMirror 6: react wrapper, YAML, lint   | 141 KB                                                                           | none    | none                                                                                                                                 |
| CodeMirror 6 plus markdown and merge view | 216 KB                                                                           | none    | none                                                                                                                                 |
| Monaco 0.57.0 + monaco-yaml 5.5.1         | 692 KB main + 94 KB editor worker + 319 KB YAML worker = 1105 KB, plus 88 KB CSS | 2       | worker imports and `MonacoEnvironment.getWorker`; `@monaco-editor/react` loads Monaco from a CDN unless pointed at the local package |

Why:

- 141 KB against 1105 KB, no web workers, and nothing to configure in
  Vite. A local-only app must not fetch the editor from a CDN.
- Monaco's main gain is JSON-schema validation and completion through
  monaco-yaml. We get validation without it: parse with `yaml`, validate
  with the shared zod schema, and map each error to a source range through
  the `yaml` document's node ranges, then hand those to the CodeMirror
  linter as diagnostics. The same errors drive the inspector fields.
- Completion from the schema is not needed for the first version.
  Revisit trigger in DES-007.
- Weekly downloads: `@uiw/react-codemirror` 7.9 M, `@codemirror/lang-yaml`
  9.3 M, `monaco-editor` 14.2 M, `monaco-yaml` 0.65 M. Both stacks are
  maintained (latest publishes 2026-04 to 2026-11).

## Graph layout

Decision: **React Flow (`@xyflow/react` 13.0.2) with `@dagrejs/dagre`
3.1.3**, layered left to right, run on every graph change. No saved
positions (DES-007 ledger).

| Option               | Bundle (gz) | API                    | Fits                                        |
| -------------------- | ----------- | ---------------------- | ------------------------------------------- |
| @dagrejs/dagre 3.1.3 | 16 KB       | sync                   | layered DAGs, which `needs` graphs are      |
| elkjs 0.12.1         | 439 KB      | async, worker optional | compound nodes, ports, edge label placement |

Why: workflows are DAGs (the engine rejects cycles, DES-005), dagre lays
them out well at 16 KB, and it is synchronous, so a YAML edit re-lays the
graph in the same frame. elkjs is 27 times larger for features we do not
need yet. React Flow itself is 86 KB gz (bundlephobia) and is used by both
the editor and the read-only run graph.

## YAML writes keep comments and key order

Use the `yaml` package Document API, which the repo already uses for
docs: `parseDocument(text)`, change nodes with `setIn`, `addIn` and
`deleteIn`, then `doc.toString()`. Never rebuild the file from a plain
object. Test plan in DES-010.
