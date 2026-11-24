import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { formatSkillMd, type Skill } from "@workspace/core"

/** Cursor work-dir layout for skills (DES-041 / BL-170). */
export const CURSOR_SKILLS_DIR = ".cursor/skills"

type SkillPlacement = {
  path: string
  previous: string | null
  folder: string
  folderExisted: boolean
}

const skillPlacements = new Map<string, SkillPlacement[]>()

/**
 * Copy the node's selected skills into
 * `<workDir>/.cursor/skills/<slug>/SKILL.md` (BL-170).
 */
export async function placeSkills(
  skills: readonly Skill[],
  workDir: string
): Promise<void> {
  const placed: SkillPlacement[] = []
  for (const skill of skills) {
    const folder = join(workDir, CURSOR_SKILLS_DIR, skill.slug)
    const path = join(folder, "SKILL.md")
    const folderExisted = await dirExists(folder)
    let previous: string | null
    try {
      previous = await readFile(path, "utf8")
    } catch {
      previous = null
    }

    const text = formatSkillMd({
      name: skill.name,
      description: skill.description,
      body: skill.body,
    })
    await mkdir(folder, { recursive: true })
    await writeFile(path, text, "utf8")
    placed.push({ path, previous, folder, folderExisted })
  }
  skillPlacements.set(workDir, placed)
}

/** Remove or restore skill files placed by {@link placeSkills}. */
export async function cleanupPlacedSkills(workDir: string): Promise<void> {
  const placed = skillPlacements.get(workDir)
  if (!placed) return
  skillPlacements.delete(workDir)
  for (const entry of placed) {
    if (entry.previous === null) {
      try {
        await rm(entry.path)
      } catch {
        /* already gone */
      }
      if (!entry.folderExisted) {
        try {
          await rm(entry.folder, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
      }
      continue
    }
    await mkdir(dirname(entry.path), { recursive: true })
    await writeFile(entry.path, entry.previous, "utf8")
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}
