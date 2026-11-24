---
id: BL-204
title: "Library sheet, versions, pin and pull"
type: backlog
status: todo
summary: Library items open in a sheet with versions, pin, pull, update and remove.
tags: [web, library]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-193]
---

# Library sheet, versions, pin and pull

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Rebuild `LibrarySheet` and `LibraryVersions` on `library/get`, `library/pin_version`, `library/pull`, `library/update` and `library/remove`.

## Done when

- [ ] Pin a version and pull a new one.
- [ ] Remove asks for confirmation.
- [ ] e2e covers pin and pull.
