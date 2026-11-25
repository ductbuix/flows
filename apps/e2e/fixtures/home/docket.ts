import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Docket board and sample cards for BL-177 e2e. */
export function seedDocket(home: string): void {
  const docket = join(home, "docket")
  mkdirSync(join(docket, "cards", "fix-login"), { recursive: true })
  writeFileSync(
    join(docket, "board.yaml"),
    [
      "version: 1",
      "columns:",
      "  - { id: todo, label: Todo, tone: idle }",
      "  - { id: doing, label: Doing, tone: working }",
      "  - { id: review, label: Review, tone: attention }",
      "  - { id: done, label: Done, tone: done, done: true }",
      "face: []",
      "",
    ].join("\n")
  )
  mkdirSync(join(docket, "cards", "fix-login", "assets"), { recursive: true })
  writeFileSync(
    join(docket, "cards", "fix-login", "assets", "acceptance.md"),
    "# Acceptance\n\nLogin stays green for 20 runs.\n"
  )
  writeFileSync(
    join(docket, "cards", "fix-login", "card.md"),
    [
      "---",
      "id: fix-login",
      "title: Fix flaky login",
      "status: doing",
      "rank: m",
      "created: 2026-11-20T09:12:00Z",
      "updated: 2026-11-23T10:00:00Z",
      "due: 2026-11-28",
      "refs:",
      "  - system: rally",
      "    id: US1234",
      "    label: Login flake on CI",
      "    syncedAt: 2026-11-23T10:00:00Z",
      "    data:",
      "      State: In progress",
      "      Iteration: Sprint 42",
      "      Owner: flows",
      "assets:",
      "  - path: assets/acceptance.md",
      "    label: Acceptance criteria",
      "---",
      "",
      "Stabilize the login e2e.",
      "",
    ].join("\n")
  )
  mkdirSync(join(docket, "cards", "refactor-auth"), { recursive: true })
  writeFileSync(
    join(docket, "cards", "refactor-auth", "card.md"),
    [
      "---",
      "id: refactor-auth",
      "title: Refactor auth session",
      "status: todo",
      "rank: m",
      "created: 2026-11-21T09:00:00Z",
      "updated: 2026-11-23T10:00:00Z",
      "---",
      "",
      "Pull session handling into one module.",
      "",
    ].join("\n")
  )
}
