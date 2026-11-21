---
id: BL-018
title: App-owned agent CLI trust and pre-run check
type: backlog
status: todo
summary: Trust dialog for all of FLOWAPP_HOME, Cursor marker write, and a warn-only pre-run check.
tags: [agents, trust, sandbox, ui]
related: [DES-019, DES-006]
updated: 2026-11-21
priority: P1
depends: [BL-017]
---

# App-owned agent CLI trust and pre-run check

Design: [DES-019](../designs/des-019-agent-trust-and-timeouts.md).
Depends on [BL-017](bl-017-attempt-timeout.md) because the live Cursor
verification can hang without a timeout, and because stderr mapping
from BL-017 is how a failed marker write is shown.

## Done when

- [ ] Before a run that may launch an agent CLI, a dialog asks
      Trust once, Always trust, or Cancel when always-trust is not
      stored. Trust once covers that run only.
- [ ] Always trust is a settings row in `app.db`, bound to the
      `FLOWAPP_HOME` realpath. A realpath change asks again. It can
      be revoked from a settings place on the home screen.
- [ ] `decideTrust` is the one policy function; server and engine
      both call it. The CliAdapter, check list, and storage match
      DES-019.
- [ ] After a grant, the unsandboxed engine writes Cursor's trust
      marker for `FLOWAPP_HOME` before spawn. The marker is kept
      while always-trust is valid or a granted run is live, then
      removed.
- [ ] Pre-run checks from DES-019 show as pass or warn in the same
      dialog. Warnings never block, including a path outside
      `FLOWAPP_HOME`. When always-trusted, the dialog appears only
      if a warning exists.
- [ ] One real Cursor agent task is run under the sandbox to
      confirm marker behavior (inheritance from `FLOWAPP_HOME`,
      including the three-component depth rule). If inheritance
      fails, the workflow-dir fallback in DES-019 is applied and
      documented.
- [ ] Unit tests cover `decideTrust`, realpath binding, marker
      keep-and-remove around concurrent runs, path checks, and
      rejected traversal outside the intended home.
- [ ] Playwright tests for once, always, cancel, revoke, and a
      warning-only dialog when already trusted, with video and
      screenshots.
