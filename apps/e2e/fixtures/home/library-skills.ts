import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Skill source Library item (BL-206): v1/v2 with skills under skills/. */
export function seedRepoTeamSkills(home: string): void {
  const id = "repo-team-skills"
  const dir = join(home, "library", id)
  mkdirSync(join(dir, "v1", "skills", "write-tests"), { recursive: true })
  mkdirSync(join(dir, "v1", "skills", "review-pr"), { recursive: true })
  mkdirSync(join(dir, "v2", "skills", "write-tests"), { recursive: true })
  mkdirSync(join(dir, "v2", "skills", "review-pr"), { recursive: true })
  writeFileSync(
    join(dir, "item.yaml"),
    [
      `id: ${id}`,
      "kind: repo",
      "title: team/skills",
      "source: github",
      "remoteId: team/skills",
      "remoteUrl: https://github.com/team/skills",
      "tags:",
      "  - repo:team/skills",
      "current: 2",
      "",
    ].join("\n")
  )
  const skillMd = (slug: string, desc: string, rules: string[], tag: string) =>
    [
      "---",
      `name: ${slug}`,
      `description: ${desc}`,
      "---",
      "",
      `# ${slug}`,
      "",
      ...rules.map((r) => `- ${r}`),
      "",
      `<!-- ${tag} -->`,
      "",
    ].join("\n")
  writeFileSync(
    join(dir, "v1", ".version.yaml"),
    [
      "n: 1",
      "at: 2026-11-20T10:00:00.000Z",
      "note: First fetch",
      "contentHash: skills-v1",
      "",
    ].join("\n")
  )
  writeFileSync(
    join(dir, "v1", "skills", "write-tests", "SKILL.md"),
    skillMd(
      "write-tests",
      "Write focused unit tests for a changed file.",
      ["Read the diff first", "One behaviour per test"],
      "v1"
    )
  )
  writeFileSync(
    join(dir, "v1", "skills", "review-pr", "SKILL.md"),
    skillMd(
      "review-pr",
      "Review a pull request for correctness and risk.",
      ["Start with the riskiest file"],
      "v1"
    )
  )
  writeFileSync(
    join(dir, "v2", ".version.yaml"),
    [
      "n: 2",
      "at: 2026-11-22T12:00:00.000Z",
      "note: Second fetch",
      "contentHash: skills-v2",
      "",
    ].join("\n")
  )
  writeFileSync(
    join(dir, "v2", "skills", "write-tests", "SKILL.md"),
    skillMd(
      "write-tests",
      "Write focused unit tests for a changed file.",
      ["Read the diff first", "One behaviour per test", "Cover the edge"],
      "v2"
    )
  )
  writeFileSync(
    join(dir, "v2", "skills", "review-pr", "SKILL.md"),
    skillMd(
      "review-pr",
      "Review a pull request for correctness and risk.",
      ["Start with the riskiest file", "Separate must-fix from nits"],
      "v2"
    )
  )
}
