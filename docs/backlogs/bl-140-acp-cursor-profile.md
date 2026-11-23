---
id: BL-140
title: Cursor ACP profile
type: backlog
status: todo
summary: "AgentProfile for Cursor: agent acp command, cursor_login auth, --model at spawn, version check for agent/list."
tags: [acp, cursor, agents]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-137]
---

# Cursor ACP profile

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp/profiles.

First real profile. Capability flags (`mcpParam`, `setModel`) start false until verified.

## Done when

- [ ] Spawns `agent [--model m] acp` through ProcessRunner with cwd = step work dir.
- [ ] Calls `authenticate` with `cursor_login` when required; failure is a typed `needs_trust` error.
- [ ] `agent/list` reports Cursor found or missing with version; test with a stub binary on PATH.
