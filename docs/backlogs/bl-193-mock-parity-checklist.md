---
id: BL-193
title: "Mock parity checklist"
type: backlog
status: todo
summary: One checklist of every mock screen, action and state from commit 22ff78c, each marked app, partial or missing, with a test id.
tags: [docs, mock, audit]
related: [DES-043]
updated: 2026-11-24
priority: P0
depends: []
---

# Mock parity checklist

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: docs.

Read the mock at `22ff78c` (`apps/web/src/pages/mock/`). List every screen, dialog, action and state per area. Mark each against the app. The checklist is the acceptance list for BL-198 to BL-212 and BL-216.

## Done when

- [ ] Checklist file lives under `docs/` and is linked from DES-043.
- [ ] Every row has a status and a test id.
- [ ] Every row marked missing maps to a backlog item.
