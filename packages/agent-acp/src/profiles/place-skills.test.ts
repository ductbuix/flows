import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parseSkillMd, type Skill } from "@workspace/core"
import {
  cleanupPlacedSkills,
  CURSOR_SKILLS_DIR,
  placeSkills,
} from "./place-skills.ts"
import { placeMcp } from "./place-mcp.ts"
import { cursorProfile } from "./cursor.ts"

const sample: Skill = {
  slug: "demo-skill",
  name: "Demo Skill",
  description: "A skill for placement tests",
  body: "Do the demo thing.\n",
}

describe("placeSkills", () => {
  it("writes only selected skills under .cursor/skills/<slug>/", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "flows-place-skills-"))
    const other: Skill = {
      slug: "other",
      name: "Other",
      description: "Not selected in a real node",
      body: "other\n",
    }
    await placeSkills([sample], workDir)
    const path = join(workDir, CURSOR_SKILLS_DIR, sample.slug, "SKILL.md")
    expect(existsSync(path)).toBe(true)
    expect(
      existsSync(join(workDir, CURSOR_SKILLS_DIR, other.slug, "SKILL.md"))
    ).toBe(false)
    const parsed = parseSkillMd(readFileSync(path, "utf8"), sample.slug)
    expect(parsed.name).toBe(sample.name)
    expect(parsed.description).toBe(sample.description)
    expect(parsed.body.trim()).toBe(sample.body.trim())
  })

  it("cleanup removes placed skills and leaves pre-existing ones", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "flows-place-skills-clean-"))
    const userDir = join(workDir, CURSOR_SKILLS_DIR, "user-skill")
    mkdirSync(userDir, { recursive: true })
    const userPath = join(userDir, "SKILL.md")
    const userText = "---\nname: User\ndescription: Keep me\n---\n\nuser body\n"
    writeFileSync(userPath, userText)

    await placeSkills([sample], workDir)
    const placedPath = join(workDir, CURSOR_SKILLS_DIR, sample.slug, "SKILL.md")
    expect(existsSync(placedPath)).toBe(true)

    await cleanupPlacedSkills(workDir)
    expect(existsSync(placedPath)).toBe(false)
    expect(existsSync(join(workDir, CURSOR_SKILLS_DIR, sample.slug))).toBe(
      false
    )
    expect(readFileSync(userPath, "utf8")).toBe(userText)
  })

  it("profile cleanup removes placed skills and mcp.json together", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "flows-place-both-"))
    await placeSkills([sample], workDir)
    await placeMcp([{ command: "echo", args: ["gw"] }], workDir)
    const skillPath = join(workDir, CURSOR_SKILLS_DIR, sample.slug, "SKILL.md")
    const mcpPath = join(workDir, ".cursor/mcp.json")
    expect(existsSync(skillPath)).toBe(true)
    expect(existsSync(mcpPath)).toBe(true)

    await cursorProfile.cleanup?.(workDir)
    expect(existsSync(skillPath)).toBe(false)
    expect(existsSync(mcpPath)).toBe(false)
  })

  it("restores a skill file that already existed", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "flows-place-skills-restore-"))
    const folder = join(workDir, CURSOR_SKILLS_DIR, sample.slug)
    mkdirSync(folder, { recursive: true })
    const path = join(folder, "SKILL.md")
    const prior = "---\nname: Old\ndescription: Prior copy\n---\n\nold\n"
    writeFileSync(path, prior)
    await placeSkills([sample], workDir)
    expect(parseSkillMd(readFileSync(path, "utf8"), sample.slug).name).toBe(
      sample.name
    )
    await cleanupPlacedSkills(workDir)
    expect(readFileSync(path, "utf8")).toBe(prior)
  })
})
