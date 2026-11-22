---
id: DES-037
title: Node workflows delivery, verification and risks
type: design
status: draft
summary: Order of verifiable slices for node workflows, how each is verified, and the top risks with their guards.
tags: [design, delivery, testing, risks, nodes]
related:
  [DES-031, DES-032, DES-033, DES-034, DES-035, DES-036, DES-017, DES-030]
updated: 2026-11-22
---

# Node workflows delivery, verification and risks

Each slice ends with something pootato can run and check. The backlogs
hold the acceptance criteria; DES-017 holds the phases.

## Slices

| Slice | Backlogs               | What works at the end                                                                                                   |
| ----- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1     | BL-074, BL-075, BL-076 | a v2 workflow with Trigger, Prompt, Agent, Command and folder Output runs end to end; spawn and old conditions are gone |
| 2     | BL-077, BL-078         | the canvas: empty state, Add node, drag to connect, settings on nodes, saved positions                                  |
| 3     | BL-086                 | Run step on a node, live status and results on the canvas, run history                                                  |
| 4     | BL-079, BL-080, BL-081 | Judge picks a path, Approval holds a run, a Judge loop ends by verdict or limit                                         |
| 5     | BL-082, BL-083, BL-084 | Asset feeds repos and pages, LLM node, publish and notify Outputs                                                       |
| 6     | BL-085, BL-087         | named answers and `{{name}}`, Judge check mode, run view for node steps                                                 |

Slices 1 to 3 give the new editing experience on a small set of kinds
early. Later slices add kinds one at a time through the registry, which
also proves the registry works.

The current renovation keeps going in parallel where it does not
conflict: BL-065 (frame, amended) and BL-067 (amended) come before
slice 2; BL-068 to BL-071 are unaffected.

## Verification

- Unit tests, per layer:
  - shared: schema per kind, port table, edge rules, template names,
    YAML edit helpers keep comments (DES-013 fixtures);
  - engine: walk cases as table tests (join, skip on branch miss, loop
    pass, loop limit, Approval reject, partial runs), each executor,
    crash between event and action for each kind (resume harness in
    `packages/engine/src/resume-harness.ts`);
  - registry completeness test (DES-035).
- Server tests: PUT with nodes, node folder trash and rename, layout
  writes with orphan cleanup, v1 file rejected as "Old format".
- e2e (Playwright, temporary `FLOWAPP_HOME`, never the user's data):
  build the sample workflow on the canvas, run it, approve, see the
  loop pass count, see results on nodes.
- UI backlogs: Playwright videos plus light and dark screenshots of the
  changed screens, and refreshed BL-061 layout baselines.
- Live checks with real CLIs stay opt-in, as today's live trust test.
- Each slice: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` and `pnpm docs:check` pass.

## Risks and guards

| Risk                                           | Guard                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Back-edge loops run forever or rerun too much  | `loopPasses` limit; cache keyed by pass and input; walk table tests     |
| A crash leaves a no-process step half done     | `step_started` before acting; no-process kinds repeat safely on resume  |
| Judge answers are unclear or drift             | first-word parse, unclear fails; the rule file shows in the step detail |
| Layout file and YAML disagree                  | key by node id; dagre for missing; drop orphans; rename moves the entry |
| Downstream steps lose upstream paths at gates  | Judge and Approval forward inputs; a data passing test per kind         |
| Kind switches creep back outside the registry  | lint rule against `kind ===` outside registries; completeness test      |
| Scope grows toward OpenBot's triggers and apps | DES-031 non-goals; trigger types stay an open question                  |
| Copying OpenBot code or text by accident       | ideas only; reviews check for copied strings and structure              |

## Done when (this plan)

- [ ] DES-031 to DES-037 and BL-074 to BL-087 are on `develop`.
- [ ] Reversed docs carry a note pointing to DES-031.
- [ ] Open questions in DES-031 have answers or are marked later.
