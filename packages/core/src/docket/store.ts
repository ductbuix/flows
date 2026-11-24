import {
  patchCardMd,
  patchYamlMapping,
  splitCardMd,
  tolerantParseBoard,
  tolerantParseCard,
  yamlMappingToJs,
  type Board,
  type Card,
  type TolerantParseResult,
} from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import type {
  DocumentStore,
  DocumentWriteResult,
} from "../ports/document-store.ts"

export const DOCKET_BOARD_PATH = "docket/board.yaml"
export const DOCKET_CARDS_GLOB = "docket/cards/*/card.md"

const CARD_PATH_RE = /^docket\/cards\/([^/]+)\/card\.md$/

export type CardFile = {
  id: string
  path: string
  text: string
  hash: string
  data: Card | null
  warnings: string[]
}

export type BoardFile = {
  path: string
  text: string
  hash: string
  data: Board | null
  warnings: string[]
}

export type DocketStoreDeps = {
  docs: DocumentStore
  clock: Clock
}

export function cardPath(cardId: string): string {
  return `docket/cards/${cardId}/card.md`
}

export function cardIdFromPath(path: string): string | null {
  const norm = path.replace(/\\/g, "/").replace(/^\//, "")
  return CARD_PATH_RE.exec(norm)?.[1] ?? null
}

export function createDocketStore(deps: DocketStoreDeps) {
  return new DocketStore(deps)
}

export class DocketStore {
  constructor(private readonly deps: DocketStoreDeps) {}

  nowIso(): string {
    return new Date(this.deps.clock.now()).toISOString()
  }

  readBoard(): BoardFile | null {
    const disk = this.deps.docs.read(DOCKET_BOARD_PATH)
    if (!disk) return null
    return parseBoardFile(disk.text, disk.hash)
  }

  writeBoardRaw(text: string, baseHash?: string): DocumentWriteResult {
    return this.deps.docs.write(DOCKET_BOARD_PATH, text, { baseHash })
  }

  saveBoard(board: Board, baseHash?: string): DocumentWriteResult {
    const disk = this.deps.docs.read(DOCKET_BOARD_PATH)
    const baseText = disk?.text ?? "version: 1\ncolumns: []\n"
    const text = patchYamlMapping(baseText, {
      version: board.version,
      columns: board.columns,
      face: board.face ?? [],
    })
    return this.deps.docs.write(DOCKET_BOARD_PATH, text, { baseHash })
  }

  listCards(): CardFile[] {
    const paths = this.deps.docs.list(DOCKET_CARDS_GLOB)
    const cards: CardFile[] = []
    for (const path of paths) {
      const id = cardIdFromPath(path)
      if (!id) continue
      const card = this.readCard(id)
      if (card) cards.push(card)
    }
    return cards.sort((a, b) => a.id.localeCompare(b.id))
  }

  readCard(cardId: string): CardFile | null {
    const path = cardPath(cardId)
    const disk = this.deps.docs.read(path)
    if (!disk) return null
    return parseCardFile(cardId, path, disk.text, disk.hash)
  }

  writeCardRaw(
    cardId: string,
    text: string,
    baseHash?: string
  ): DocumentWriteResult {
    return this.deps.docs.write(cardPath(cardId), text, { baseHash })
  }

  deleteCard(cardId: string) {
    return this.deps.docs.remove(cardPath(cardId))
  }

  saveCard(
    cardId: string,
    patch: Record<string, unknown>,
    options?: { body?: string; baseHash?: string }
  ): DocumentWriteResult {
    const path = cardPath(cardId)
    const disk = this.deps.docs.read(path)
    const updated = new Date(this.deps.clock.now()).toISOString()
    const baseText = disk?.text ?? joinMinimalCard(cardId, updated)
    const text = patchCardMd(baseText, { ...patch, updated }, options?.body)
    return this.deps.docs.write(path, text, {
      baseHash: options?.baseHash ?? disk?.hash,
    })
  }
}

function joinMinimalCard(cardId: string, updated: string): string {
  return `---\nid: ${cardId}\ntitle: Untitled\nstatus: todo\ncreated: ${updated}\nupdated: ${updated}\n---\n\n`
}

function parseCardFile(
  id: string,
  path: string,
  text: string,
  hash: string
): CardFile {
  const split = splitCardMd(text)
  if (!split) {
    return {
      id,
      path,
      text,
      hash,
      data: null,
      warnings: ["card.md: missing or invalid frontmatter fence"],
    }
  }

  const { value, error } = yamlMappingToJs(split.frontmatter)
  if (error) {
    return {
      id,
      path,
      text,
      hash,
      data: null,
      warnings: [`frontmatter: ${error}`],
    }
  }

  const parsed: TolerantParseResult<Card> = tolerantParseCard(value)
  return {
    id,
    path,
    text,
    hash,
    data: parsed.data,
    warnings: parsed.warnings,
  }
}

function parseBoardFile(text: string, hash: string): BoardFile {
  const { value, error } = yamlMappingToJs(text)
  if (error) {
    return {
      path: DOCKET_BOARD_PATH,
      text,
      hash,
      data: null,
      warnings: [`board.yaml: ${error}`],
    }
  }
  const parsed = tolerantParseBoard(value)
  return {
    path: DOCKET_BOARD_PATH,
    text,
    hash,
    data: parsed.data,
    warnings: parsed.warnings,
  }
}
