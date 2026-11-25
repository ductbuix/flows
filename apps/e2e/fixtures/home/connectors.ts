import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Connector definitions for BL-181 e2e. */
export function seedConnectors(home: string): void {
  const connectorsDir = join(home, "connectors")
  mkdirSync(connectorsDir, { recursive: true })
  writeFileSync(
    join(connectorsDir, "github-cli.yaml"),
    [
      "id: github-cli",
      "name: GitHub",
      "transport: cli",
      "how: gh",
      "auth: cli-login",
      "providerId: github",
      "capabilities:",
      "  - name: repo clone",
      "    desc: Read repositories",
      "    write: false",
      "    allowed: true",
      "    cmd: [repo, clone]",
      "  - name: repo push",
      "    desc: Push local changes",
      "    write: true",
      "    allowed: true",
      "    cmd: [repo, push]",
      "  - name: pr merge",
      "    desc: Merge a pull request",
      "    write: true",
      "    allowed: false",
      "    cmd: [pr, merge]",
      "",
    ].join("\n")
  )
  writeFileSync(
    join(connectorsDir, "rally.yaml"),
    [
      "id: rally",
      "name: Rally",
      "transport: api",
      "how: https://rally.example/api",
      "auth: cookies",
      "capabilities:",
      "  - name: artifact read",
      "    desc: Read stories and defects",
      "    write: false",
      "    allowed: true",
      "",
    ].join("\n")
  )
}
