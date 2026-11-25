import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Library items for BL-204 e2e (list, sheet, pin, pull, remove). */
export function seedLibraryItems(home: string): void {
  {
    const id = "github-acme-demo"
    const dir = join(home, "library", id)
    mkdirSync(join(dir, "v1"), { recursive: true })
    mkdirSync(join(dir, "v2"), { recursive: true })
    writeFileSync(
      join(dir, "item.yaml"),
      [
        `id: ${id}`,
        "kind: repo",
        "title: acme/demo",
        "source: github",
        "remoteId: acme/demo",
        "remoteUrl: https://github.com/acme/demo",
        "tags:",
        "  - repo:acme/demo",
        "  - project:e2e",
        "current: 2",
        "",
      ].join("\n")
    )
    writeFileSync(
      join(dir, "v1", ".version.yaml"),
      [
        "n: 1",
        "at: 2026-11-20T10:00:00.000Z",
        "note: First fetch",
        "contentHash: hash-v1",
        "",
      ].join("\n")
    )
    writeFileSync(join(dir, "v1", "README.md"), "version one\n")
    writeFileSync(
      join(dir, "v2", ".version.yaml"),
      [
        "n: 2",
        "at: 2026-11-22T12:00:00.000Z",
        "note: Second fetch",
        "contentHash: hash-v2",
        "",
      ].join("\n")
    )
    writeFileSync(join(dir, "v2", "README.md"), "version two\n")
  }
  {
    const id = "local-notes"
    const dir = join(home, "library", id)
    mkdirSync(join(dir, "v1"), { recursive: true })
    writeFileSync(
      join(dir, "item.yaml"),
      [
        `id: ${id}`,
        "kind: other",
        "title: Scratch notes",
        "source: local",
        "tags:",
        "  - type:notes",
        "current: 1",
        "",
      ].join("\n")
    )
    writeFileSync(
      join(dir, "v1", ".version.yaml"),
      [
        "n: 1",
        "at: 2026-11-18T09:00:00.000Z",
        "note: Imported",
        "contentHash: hash-notes",
        "",
      ].join("\n")
    )
    writeFileSync(join(dir, "v1", "notes.md"), "# Notes\n")
  }
}
