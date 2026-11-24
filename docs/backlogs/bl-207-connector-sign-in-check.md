---
id: BL-207
title: "Connector sign-in, check and update"
type: backlog
status: todo
summary: Connector sheet can sign in, check status and update settings.
tags: [web, connectors, desktop]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-193]
---

# Connector sign-in, check and update

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Call `connector/sign_in`, `connector/check` and `connector/update`. In the desktop app use `host/browser_sign_in`.

## Done when

- [ ] Sign in and check from the sheet.
- [ ] An expired sign-in shows an attention pill.
- [ ] e2e covers check and update.
