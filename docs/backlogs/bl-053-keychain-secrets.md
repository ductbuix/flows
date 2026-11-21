---
id: BL-053
title: Keychain secrets and Remove sign-in
type: backlog
status: todo
summary: Tokens and cookies in the macOS Keychain under flowapp.<connectionId>, never in argv, files or logs; Remove sign-in revokes.
tags: [engine, connections, secrets, security]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-042]
---

# Keychain secrets and Remove sign-in

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Secrets). Needed by Rally and Confluence, not by
GitHub. The `security` CLI takes the secret on stdin, never in argv,
so it does not show in `ps`.

## Done when

- [ ] A `SecretStore` interface with a Keychain implementation
      (service `flowapp.<connectionId>`) and an in-memory one for
      tests.
- [ ] Secrets are written through stdin; a test asserts no spawned
      argv contains the secret.
- [ ] Connectors read secrets only during `check`, `pull` and
      `publish`; tasks never get them in env.
- [ ] "Remove sign-in" on the connection page deletes the items, marks
      the connection signed out and keeps library data.
- [ ] A test scans `FLOWAPP_HOME` and logs after a pull and finds no
      secret.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
