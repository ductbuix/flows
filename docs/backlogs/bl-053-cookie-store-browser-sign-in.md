---
id: BL-053
title: Cookie store and browser sign-in
type: backlog
status: done
summary: Cookies from a Chrome sign-in saved under FLOWAPP_HOME/secrets/, hidden from tasks by the sandbox; Remove sign-in revokes.
tags: [engine, connections, secrets, security, sandbox]
related: [DES-026, DES-006]
updated: 2026-11-22
priority: P2
depends: [BL-042]
---

# Cookie store and browser sign-in

Design: [DES-026](../designs/des-026-work-items-library-connections.md)
(Secrets). Needed by Rally, not by GitHub (CLI owns its login) or
Confluence (MCP owns its login). No Keychain.

## Done when

- [x] `packages/engine/src/secrets.ts` reads and writes
      `FLOWAPP_HOME/secrets/<connectionId>/cookies.json` (file 0600,
      folders 0700, atomic writes). Nothing else in Flows writes
      under `secrets/`.
- [x] "Sign in with browser" on the connection page launches the
      installed Chrome through `playwright-core` (`channel: "chrome"`)
      with a dedicated profile under `secrets/<connectionId>/profile/`.
      When the user closes the window, Flows saves the cookies for the
      connection's domain and runs `check`. The user's own Chrome
      profile is never read. A missing Chrome is a clear error.
- [x] The task sandbox profile denies `file-read*` under `secrets/`.
      A test shows a sandboxed task cannot read `cookies.json`; an
      unsandboxed run (`FLOWAPP_SANDBOX=0`) warns that this protection
      is off.
- [x] Connectors read cookies only during `check`, `pull` and
      `publish`; tasks never get them in env, files or the library.
- [x] "Remove sign-in" deletes `secrets/<connectionId>/`, marks the
      connection signed out and keeps library data.
- [x] A test scans `FLOWAPP_HOME` outside `secrets/` and the logs
      after a pull and finds no cookie value.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
