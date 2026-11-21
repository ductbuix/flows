---
id: DES-023
title: Model and effort for agent tasks
type: design
status: active
summary: Optional model and effort on agent tasks, workflow defaults, and judges, resolved then passed to each CLI.
tags: [agents, yaml, editor, engine]
related:
  [
    DES-002,
    DES-005,
    DES-007,
    DES-009,
    DES-010,
    DES-019,
    DES-020,
  ]
updated: 2026-11-21
---

# Model and effort for agent tasks

Agent tasks and judges today pick only a CLI. The model and effort
come from that CLI's own settings. This design adds optional
`model` and `effort` on the task, the workflow, and each agent
judge. Empty means the flag is omitted, so the CLI's settings
apply.

On this machine those settings are Claude
`~/.claude/settings.json` (`model` haiku, `effortLevel` medium)
and Cursor `~/.cursor/cli-config.json` (`modelId` default, shown
as auto). The app only reads those files and never writes them.

## Yaml

`model` is an optional non-empty string. `effort` is optional and
one of `low`, `medium`, `high`, `xhigh`, `max`. Both may appear
on an agent task, on an agent judge (`when`, `until`, or a need
condition), and as per-CLI workflow defaults:

```yaml
agent:
  claude:
    model: sonnet
    effort: high
  cursor:
    model: grok-4.7
    effort: medium
tasks:
  - id: task-a1b2c3d4
    kind: agent
    cli: claude
    model: opus
    effort: xhigh
    when:
      agent:
        cli: claude
        model: haiku
        effort: low
```

Workflow defaults are per CLI, not a single pair, so a Claude
default cannot leak onto a Cursor task. The `agent:` map is new
at the workflow root, next to `timeout` and `limits`.

Resolution, most specific first:

1. The judge's own `model` / `effort`, when launching a judge.
2. The parent task, when that task is an agent with the same
   `cli`.
3. `agent.<cli>` on the workflow (the frozen graph).
4. Omit the flags, so the CLI's own settings apply.

A field is resolved on its own: a task may set only `effort` and
still inherit `model` from the workflow or the CLI. An empty
string is invalid yaml; omit the key instead.

Spawn specs use the same agent task schema, so they may set
`model` and `effort` too.

## Adapters

`CliAdapter` (DES-019) gains three methods. Adding them to the
existing record avoids a second abstraction.

- `readDefaults()` reads the CLI settings file from the user's
  home and returns `{ model, effort }` if present. Cursor
  `modelId: default` becomes `auto`. Missing or unreadable files
  yield an empty result.
- `listModels()` returns a catalog: the current defaults (for
  labels such as "Default (haiku)") and a list of `{ id, label,
  efforts }`. Claude's list is the aliases `opus`, `sonnet`, and
  `haiku` (plus a custom value in the UI). Cursor runs
  `agent --list-models` (or `agent models`) and groups ids into
  families (see below).
- `composeFlags({ model, effort })` returns the argv to add to
  the existing command. Claude adds `--model` and/or `--effort`
  when resolved. Cursor adds a single `--model` whose value is
  the composed id. When both values fall through to the CLI,
  it returns no flags.

`buildAgentCommand` and `buildJudgeCommand` take the already
resolved pair and pass it to `composeFlags`. The judge cache key
must include the resolved model and effort, or two judges that
differ only by model would share a result.

`describeFlags` stays the stable flag set. Preflight adds a
separate warn-only check that lists each agent task and judge
with the resolved model and effort, and warns when the model is
unknown or the effort is not offered for that model. It never
blocks.

## Cursor family mapping

Cursor model ids embed effort, for example `grok-4.7-high`,
`gpt-5.3-codex-low-fast`, `claude-opus-5-thinking-xhigh`, and
`claude-opus-5-5-max`. Some ids have no effort token, such as
`auto`, `gpt-5.2`, `composer-2.5`, and the bare `gpt-5.3-codex`.
Parameterized forms such as
`claude-opus-4-8[context=1m,effort=high,fast=false]` are valid
`--model` values and can be entered as a custom id.

The Cursor adapter parses the listed ids as follows:

1. Strip a trailing `-fast`, if present.
2. If the remainder ends in `-low`, `-medium`, `-high`,
   `-xhigh`, or `-max`, the family id is the prefix and that
   token is the effort.
3. Otherwise the family id is the remainder and the entry is
   the family's default member (no effort suffix).

The Model select lists family ids, with labels taken from the
catalog and with effort words removed (for example "Grok 4.7",
"Codex 5.3", "Auto"). The Effort select lists only the efforts
that family actually listed, plus Default (CLI or workflow).
Composing uses `${family}-${effort}` when an effort is resolved,
or the bare family id when it is not and that id exists.

This cut does not add a Fast toggle. Composition prefers the
non-fast id. If only a `-fast` id exists for that family and
effort, that id is used. Fast-only siblings such as
`composer-2.5-fast` are not offered in the Effort select; a
custom id can still name them.

The parser is unit-tested against a fixture of `agent
--list-models` output, so a live CLI is not required for tests.
A later Cursor list that adds families should keep working if
it follows the same suffix pattern.

## Attempts, API, and UI

`attempt_launched` records `model`, `effort`, and
`modelSource` (`task`, `workflow`, or `cli`). When flags were
omitted, `model` and `effort` are the values from
`readDefaults()` if known, otherwise they are omitted and
`modelSource` is `cli`. The run view shows them on the attempt.

`GET /api/cli/:cli/models` returns the catalog. The server
caches it briefly (60 seconds) because a Cursor listing may be
slow. If listing fails, the response still includes the Default
option and an error message; the user can type a custom id.

In the drawer, after the CLI select, Model and Effort selects
appear. The first option is "Default (haiku)" (or "Default"
when the settings file cannot be read, or "Default (auto)" for
Cursor). A custom model id is always allowed. Changing `cli`
keeps the current values; if they are not in the new catalog,
they stay visible as a custom value and preflight may warn.

The workflow inspector (no node selected) has an Agent defaults
section with the same selects, grouped by Claude and Cursor.

The drawer does not yet have a general condition editor. When
`when` or `repeat.until` (or a need's `when`) is a lone agent
leaf, the drawer shows Model and Effort on that leaf. Combined
`all` / `any` conditions stay yaml-only for these fields until
a condition editor exists.

## Impact map

| Area | What changes |
| ---- | ------------ |
| Shared | optional `model` and `effort` on agent tasks, judges, and `workflow.agent.<cli>`; shared effort enum and resolve helper |
| Engine | adapter `readDefaults`, `listModels`, `composeFlags`; command builders; judge cache key; preflight warning; `attempt_launched` fields |
| Server | `GET /api/cli/:cli/models` |
| Web | drawer and workflow-default selects; attempt row shows model and effort; Playwright videos and screenshots |
| Docs | DES-002, 005, 007, 009, 010, 016, 017, 019, 020 |

## Out of scope

A Fast toggle, writing CLI settings, a global app-level model
in `config.yaml`, and a full condition editor.
