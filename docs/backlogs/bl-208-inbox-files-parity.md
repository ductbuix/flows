---
id: BL-208
title: "Inbox and Files parity fixes"
type: backlog
status: todo
summary: Close the Inbox and Files rows of the parity checklist.
tags: [web, inbox, files]
related: [DES-043]
updated: 2026-11-24
priority: P2
depends: [BL-193]
---

# Inbox and Files parity fixes

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Compare Inbox and Files with the mock and fix every missing row. Replace the sidebar Inbox badge that reads mock runs with `inbox/list`.

## Done when

- [ ] The Inbox badge counts real items.
- [ ] All Inbox and Files checklist rows are `app`.
