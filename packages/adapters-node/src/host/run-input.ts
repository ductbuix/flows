import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join, relative } from "node:path"
import { cardItemKey, manualItemKey } from "./item-key.ts"
import {
  manualSource,
  type InputsJson,
  type ManualItem,
} from "./source-manual.ts"

/** Absolute path of a run's frozen input folder. */
export function runInputDir(runRoot: string): string {
  return join(runRoot, "input")
}

export type MaterializeRunInputResult = {
  itemKey: string
  inputHash: string
  files: string[]
  cardId?: string
}

/**
 * Copy workflow input/, materialize Manual values, write inputs.json.
 * When cardId is set, itemKey is derived from it (DES-038 / BL-039).
 */
export function materializeRunInput(
  workflowRoot: string,
  runRoot: string,
  item: ManualItem,
  cardId?: string
): MaterializeRunInputResult {
  const dest = runInputDir(runRoot)
  mkdirSync(dest, { recursive: true })
  const wfInput = join(workflowRoot, "input")
  if (existsSync(wfInput)) {
    cpSync(wfInput, dest, { recursive: true })
  }

  const { fields, inputsJson } = manualSource.materialize(item, dest)
  const itemKey =
    cardId !== undefined ? cardItemKey(cardId) : manualItemKey(fields)
  const full: InputsJson = {
    ...inputsJson,
    itemKey,
    itemKeyVersion: 1,
    ...(cardId !== undefined ? { cardId } : {}),
  }
  writeFileSync(join(dest, "inputs.json"), JSON.stringify(full, null, 2))

  const files = listRelativeFiles(dest)
  const inputHash = hashInputTree(dest, files)
  return {
    itemKey,
    inputHash,
    files,
    ...(cardId !== undefined ? { cardId } : {}),
  }
}

function listRelativeFiles(root: string): string[] {
  const out: string[] = []
  walk(root, root, out)
  return out.sort()
}

function walk(root: string, dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) {
      walk(root, abs, out)
    } else {
      out.push(relative(root, abs))
    }
  }
}

function hashInputTree(root: string, files: string[]): string {
  const parts = files.map((rel) => {
    const buf = readFileSync(join(root, rel))
    const sha = createHash("sha256").update(buf).digest("hex")
    return { path: rel, sha256: sha }
  })
  return createHash("sha256")
    .update(JSON.stringify(parts), "utf8")
    .digest("hex")
}
