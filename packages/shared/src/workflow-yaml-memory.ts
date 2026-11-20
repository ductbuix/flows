import { isSeq, parseDocument, Scalar, type Document } from "yaml"
import { tasksSeq } from "./workflow-yaml.ts"

function parse(text: string): Document {
  return parseDocument(text, { keepSourceTokens: true })
}

/** Replace a memory path in every task's memory: list (DES-013 rename). */
export function replaceMemoryRef(
  text: string,
  fromPath: string,
  toPath: string
): string {
  const doc = parse(text)
  const seq = tasksSeq(doc)
  if (!seq) return text
  for (let i = 0; i < seq.items.length; i++) {
    const mem = doc.getIn(["tasks", i, "memory"])
    if (!isSeq(mem)) continue
    for (let j = 0; j < mem.items.length; j++) {
      const item = mem.items[j]
      const val =
        typeof item === "string" || item instanceof Scalar
          ? String(item instanceof Scalar ? item.value : item)
          : null
      if (val !== fromPath) continue
      if (item instanceof Scalar) item.value = toPath
      else mem.set(j, toPath)
    }
  }
  return doc.toString()
}
