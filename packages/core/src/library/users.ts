import {
  splitCardMd,
  tolerantParseCard,
  yamlMappingToJs,
} from "@workspace/contracts"
import type { DocumentStore } from "../ports/document-store.ts"

const CARDS_GLOB = "docket/cards/*/card.md"
const CARD_PATH_RE = /^docket\/cards\/([^/]+)\/card\.md$/

/**
 * Card ids whose refs point at this library item (`system: library`).
 * Used by `library/remove` for the busy check (BL-173).
 */
export function cardUsersOfItem(docs: DocumentStore, itemId: string): string[] {
  const users: string[] = []
  for (const path of docs.list(CARDS_GLOB)) {
    const cardId = CARD_PATH_RE.exec(
      path.replace(/\\/g, "/").replace(/^\//, "")
    )?.[1]
    if (!cardId) continue
    const disk = docs.read(path)
    if (!disk) continue
    if (cardRefsItem(disk.text, itemId)) users.push(cardId)
  }
  return users.sort((a, b) => a.localeCompare(b))
}

function cardRefsItem(text: string, itemId: string): boolean {
  const split = splitCardMd(text)
  if (!split) return false
  const { value, error } = yamlMappingToJs(split.frontmatter)
  if (error || value === null || typeof value !== "object") return false
  const parsed = tolerantParseCard(value)
  const refs = parsed.data?.refs ?? []
  return refs.some((r) => r.system === "library" && r.id === itemId)
}
