---
id: BL-139
title: ACP file access through a path policy
type: backlog
status: todo
summary: The client advertises fs.readTextFile and fs.writeTextFile and serves them only inside the step work dir.
tags: [acp, agents, security]
related: [DES-041, DES-006]
updated: 2026-11-24
priority: P1
depends: [BL-137]
---

# ACP file access through a path policy

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp.

Agent file I/O goes through us so writes stay inside the allowed folder (permission rule 1).

## Done when

- [ ] `fs/read_text_file` and `fs/write_text_file` resolve paths, reject anything outside allowed roots with a JSON-RPC error.
- [ ] Writes are atomic.
- [ ] Fake agent tests: inside allowed, `..` escape rejected, symlink escape rejected.
