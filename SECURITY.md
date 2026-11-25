# Security policy

Flows is a local-only desktop and web app. It binds to `127.0.0.1`, authenticates
FCP connections with an engine lock token, and runs tasks as separate processes.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting
(Security tab, "Report a vulnerability").

Include the version or commit, steps to reproduce, and the impact. We aim to
acknowledge reports within 3 business days.

## Scope

In scope: the Electron shell, the local server and FCP protocol, the task
process runner and sandbox, secrets handling, and the MCP gateway.

Out of scope: attacks that need prior code execution as the same user, and
vulnerabilities in third-party agent CLIs that Flows only launches.

## Supported versions

Only the latest commit on `develop` is supported until the first release.
