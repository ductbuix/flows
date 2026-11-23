---
id: BL-153
title: Docket card store
type: backlog
status: done
summary: "Read and write card.md and board.yaml: tolerant parse with warnings, hash-checked writes, YAML that keeps comments and unknown keys."
tags: [docket, core, files]
related: [DES-038]
updated: 2026-11-24
priority: P1
depends: [BL-151, BL-126]
---

# Docket card store

Design: [DES-038](../designs/des-038-docket-board.md). Layer: packages/core/docket.

Files are the model (DES-038). The store is the only writer path.

## Done when

- [x] A half-valid card returns data plus warnings, never throws.
- [x] Write keeps key order, comments and unknown keys; `updated` set by the writer.
- [x] Tests on the fake DocumentStore with fixture cards.
