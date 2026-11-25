import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Workspace skills for BL-183 / BL-206 e2e (installed at v1; source current is v2). */
export function seedWorkspaceSkills(home: string): void {
  for (const dir of [".agents", ".claude"] as const) {
    const skillDir = join(home, dir, "skills", "write-tests")
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: write-tests",
        "description: Write focused unit tests for a changed file.",
        "from:",
        "  sourceId: repo-team-skills",
        "  version: 1",
        "---",
        "",
        "# write-tests",
        "",
        "- Read the diff first",
        "- One behaviour per test",
        "",
      ].join("\n")
    )
  }
  const commitStyle = join(home, ".cursor", "skills", "commit-style")
  mkdirSync(commitStyle, { recursive: true })
  writeFileSync(
    join(commitStyle, "SKILL.md"),
    [
      "---",
      "name: commit-style",
      "description: Write commit messages in this repo's style.",
      "---",
      "",
      "# commit-style",
      "",
      "- Imperative mood",
      "",
    ].join("\n")
  )
}

/** Skill source list for the Library skills sources. */
export function seedSkillSources(home: string): void {
  mkdirSync(join(home, "skills"), { recursive: true })
  writeFileSync(
    join(home, "skills", "sources.json"),
    `${JSON.stringify({ sources: ["repo-team-skills"] }, null, 2)}\n`
  )
}

/** Workflow that references write-tests (SK-07 used-by). */
export function seedSkillUses(home: string): void {
  const id = "skill-uses-write-tests"
  const dir = join(home, "workflows", id)
  mkdirSync(join(dir, "nodes", "draft"), { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    [
      `id: ${id}`,
      "goal: e2e skill used-by",
      "nodes:",
      "  - id: start",
      "    kind: trigger",
      "    type: manual",
      "  - id: draft",
      "    kind: llm",
      "    cli: claude",
      "    name: Draft with tests skill",
      "    skills:",
      "      - write-tests",
      "  - id: done",
      "    kind: output",
      "    target: folder",
      "edges:",
      "  - { from: start, to: draft }",
      "  - { from: draft, to: done }",
      "",
    ].join("\n")
  )
  writeFileSync(join(dir, "nodes", "draft", "prompt.md"), "Draft it.\n")
}
