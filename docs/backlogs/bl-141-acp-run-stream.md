---
id: BL-141
title: Agent stream in run updates and acp.ndjson
type: backlog
status: done
summary: Agent events become run/update kinds on run:<id>, coalesced per 50 ms, and every ACP message is logged to acp.ndjson.
tags: [acp, runs, fcp]
related: [DES-040, DES-041, DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-137, BL-119, BL-132]
---

# Agent stream in run updates and acp.ndjson

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core/runs, packages/agent-acp.

Make agent work visible live and replayable later.

## Done when

- [x] Chunk kinds are merged per run per 50 ms; tool calls and plans are never dropped.
- [x] `runs/<id>/steps/<step>/acp.ndjson` holds every message with secrets redacted.
- [x] Test: a scripted session yields the expected update sequence.
