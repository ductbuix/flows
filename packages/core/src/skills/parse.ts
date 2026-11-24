import {
  joinCardMd,
  patchYamlMapping,
  skillFromSchema,
  splitCardMd,
  yamlMappingToJs,
  type WireSkillSummary,
} from "@workspace/contracts"

export type SkillFrom = NonNullable<WireSkillSummary["from"]>

export type ParsedSkillMd = {
  name: string
  description: string
  body: string
  from?: SkillFrom
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
  const from = parseFrom(fm.from)

  if (!description) {
    return {
      name,
      description: "",
      body: split.body,
      from,
      problem: "SKILL.md has no description",
    }
  }

  return { name, description, body: split.body, from }
}

/** Write a SKILL.md with optional install `from` (BL-169). */
export function formatSkillMd(opts: {
  name: string
  description: string
  body: string
  from?: SkillFrom
}): string {
  const fm = patchYamlMapping("name: _\n", {
    name: opts.name,
    description: opts.description,
    from: opts.from,
  }).trimEnd()
  return joinCardMd(fm, opts.body)
}

function parseFrom(raw: unknown): SkillFrom | undefined {
  if (raw === undefined) return undefined
  const parsed = skillFromSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}
