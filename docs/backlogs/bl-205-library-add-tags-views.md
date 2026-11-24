---
id: BL-205
title: "Library: add dialog, tags and views"
type: backlog
status: done
summary: Add from a link or a file, tag items and switch views, as in the mock.
tags: [web, library, tags]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-204]
---

# Library: add dialog, tags and views

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Rebuild `AddLibraryDialog`, `ProviderDetect`, `LibraryTags`, `LibraryViews`, `LibraryFilePicker` and `RemoteBlock` on `library/set_tags` and `library/pull`.

## Done when

- [x] Add by link detects the provider.
- [x] Tags filter the list.
- [x] e2e covers add and tag.
