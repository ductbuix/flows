import { parseDocument, type Document } from "yaml"

/**
 * Comment- and order-preserving YAML edits for docket files (DES-038).
 */

function parseYamlDoc(text: string): Document {
  return parseDocument(text, { keepSourceTokens: true, strict: false })
}

export function patchYamlMapping(
  yamlText: string,
  patch: Record<string, unknown>
): string {
  const doc = parseYamlDoc(yamlText)
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) doc.deleteIn([key])
    else doc.setIn([key], doc.createNode(value))
  }
  return doc.toString()
}

const CARD_MD_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/

export function splitCardMd(
  text: string
): { frontmatter: string; body: string } | null {
  const m = text.match(CARD_MD_RE)
  if (!m) return null
  return { frontmatter: m[1]!, body: m[2]! }
}

export function joinCardMd(frontmatter: string, body: string): string {
  const fm = frontmatter.replace(/\n?$/, "")
  const bodyNorm = body.startsWith("\n") ? body.slice(1) : body
  return `---\n${fm}\n---\n\n${bodyNorm}`
}

export function patchCardMd(
  text: string,
  frontmatterPatch: Record<string, unknown>,
  body?: string
): string {
  const split = splitCardMd(text)
  if (!split) return text
  const fm = patchYamlMapping(split.frontmatter, frontmatterPatch)
  return joinCardMd(fm, body ?? split.body)
}

export function yamlMappingToJs(yamlText: string): {
  value: unknown
  error?: string
} {
  const doc = parseYamlDoc(yamlText)
  if (doc.errors.length > 0) {
    return {
      value: undefined,
      error: doc.errors.map((e) => e.message).join("; "),
    }
  }
  if (doc.contents == null) {
    return { value: undefined, error: "empty document" }
  }
  return { value: doc.toJS({ maxAliasCount: 1000 }) }
}
