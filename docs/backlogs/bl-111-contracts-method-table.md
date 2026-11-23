---
id: BL-111
title: FCP method table and error codes
type: backlog
status: todo
summary: contracts exports defineMethod, an empty FCP method table, FCP_VERSION and the DES-040 error code enum.
tags: [contracts, protocol]
related: [DES-040, DES-042]
updated: 2026-11-24
priority: P0
depends: [BL-110]
---

# FCP method table and error codes

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/contracts.

Give every FCP method one declaration (`name`, `params` zod, `result` zod, `kind: query|command`) and give errors stable codes, so engine binding and sdk derive from one table.

## Done when

- [ ] `defineMethod` and `defineNotification` infer param and result types.
- [ ] `FCP_VERSION = 1` and `ErrorCode` (`invalid_params` ... `internal`) with their JSON-RPC numbers from DES-040.
- [ ] Unit test: a sample method infers types (type test) and the error table has unique numbers.
