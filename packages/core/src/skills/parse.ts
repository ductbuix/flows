import { splitCardMd, yamlMappingToJs } from "@workspace/contracts"

export type ParsedSkillMd = {
  name: string
  description: string
  body: string
  problem?: string
}

/** Tolerant SKILL.md reader; missing description becomes `problem` (BL-168). */
export function parseSkillMd(text: string, folderSlug: string): ParsedSkillMd {
  const split = splitCardMd(text)
  if (!split) {
    return {
      name: folderSlug,
      description: "",
      body: text,
      problem: "SKILL.md has no frontmatter",
    }
  }

  const parsed = yamlMappingToJs(split.frontmatter)
  if (
    parsed.error ||
    typeof parsed.value !== "object" ||
    parsed.value === null
  ) {
    return {
      name: folderSlug,
      description: "",
      body: split.body,
      problem: parsed.error ?? "SKILL.md frontmatter is invalid",
    }
  }

  const fm = parsed.value as Record<string, unknown>
  const name =
    typeof fm.name === "string" && fm.name.trim().length > 0
      ? fm.name.trim()
      : folderSlug
  const description =
    typeof fm.description === "string" ? fm.description.trim() : ""

  if (!description) {
    return {
      name,
      description: "",
      body: split.body,
      problem: "SKILL.md has no description",
    }
  }

  return { name, description, body: split.body }
}
