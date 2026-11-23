import type { DocumentStore } from "../ports/document-store.ts"
import type { SkillDir, SkillScope } from "./paths.ts"

/** Seed a fake DocumentStore with SKILL.md trees shaped like on-disk folders. */
export function writeSkillFixture(
  docs: DocumentStore,
  opts: {
    scope?: SkillScope
    dir: SkillDir
    slug: string
    description?: string
    name?: string
    body?: string
    /** Omit frontmatter description key entirely. */
    omitDescription?: boolean
  }
): string {
  const name = opts.name ?? opts.slug
  const descriptionLine = opts.omitDescription
    ? ""
    : `description: ${opts.description ?? "A test skill."}\n`
  const text = `---
name: ${name}
${descriptionLine}---

${opts.body ?? `# ${name}\n\nDo the thing.\n`}`
  const path = `${opts.dir}/skills/${opts.slug}/SKILL.md`
  docs.write(path, text)
  return path
}
