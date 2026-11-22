import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  Scalar,
  type Document,
} from "yaml"
import type { WorkflowEdge } from "./index.ts"

/**
 * Comment-keeping edits of a node workflow file (DES-033 Writes, DES-013).
 * Each helper returns new text; a missing target returns the input.
 */

function parse(text: string): Document {
  return parseDocument(text, { keepSourceTokens: true })
}

function seqOf(doc: Document, key: "nodes" | "edges") {
  const seq = doc.get(key, true)
  return isSeq(seq) ? seq : null
}

function nodeIndex(doc: Document, id: string): number {
  const seq = seqOf(doc, "nodes")
  if (!seq) return -1
  return seq.items.findIndex((n) => isMap(n) && String(n.get("id")) === id)
}

function edgeMatches(
  item: unknown,
  e: { from: string; to: string; port?: string; branch?: string }
): boolean {
  if (!isMap(item)) return false
  return (
    String(item.get("from")) === e.from &&
    String(item.get("to")) === e.to &&
    String(item.get("port") ?? "text") === (e.port ?? "text") &&
    String(item.get("branch") ?? "") === (e.branch ?? "")
  )
}

export function addNode(text: string, node: Record<string, unknown>): string {
  const doc = parse(text)
  if (!seqOf(doc, "nodes")) doc.set("nodes", doc.createNode([]))
  const seq = seqOf(doc, "nodes")!
  // An empty `nodes: []` grows into a block list, one node per line.
  if (seq.items.length === 0) seq.flow = false
  seq.add(doc.createNode(node))
  return doc.toString()
}

/** Removes the node and every edge that names it. */
export function removeNode(text: string, id: string): string {
  const doc = parse(text)
  const idx = nodeIndex(doc, id)
  if (idx < 0) return text
  seqOf(doc, "nodes")!.delete(idx)
  const edges = seqOf(doc, "edges")
  if (edges) {
    for (let i = edges.items.length - 1; i >= 0; i--) {
      const e = edges.items[i]
      if (
        isMap(e) &&
        (String(e.get("from")) === id || String(e.get("to")) === id)
      ) {
        edges.delete(i)
      }
    }
  }
  return doc.toString()
}

/** Renames the node and every edge end that names the old id. */
export function renameNode(text: string, fromId: string, toId: string): string {
  const doc = parse(text)
  const idx = nodeIndex(doc, fromId)
  if (idx < 0) return text
  const node = seqOf(doc, "nodes")!.items[idx]
  if (!isMap(node)) return text
  node.set("id", toId)
  for (const e of seqOf(doc, "edges")?.items ?? []) {
    if (!isMap(e)) continue
    for (const end of ["from", "to"] as const) {
      const v = e.get(end, true)
      if (isScalar(v) && String(v.value) === fromId) v.value = toId
    }
  }
  return doc.toString()
}

/** Sets a node key; `undefined` deletes it. */
export function setNodeKey(
  text: string,
  id: string,
  key: string,
  value: unknown
): string {
  const doc = parse(text)
  const idx = nodeIndex(doc, id)
  if (idx < 0) return text
  const node = seqOf(doc, "nodes")!.items[idx]
  if (!isMap(node)) return text
  if (value === undefined) node.delete(key)
  else node.set(key, doc.createNode(value))
  return doc.toString()
}

export function addEdge(text: string, edge: WorkflowEdge): string {
  const doc = parse(text)
  if (!seqOf(doc, "edges")) doc.set("edges", doc.createNode([]))
  const seq = seqOf(doc, "edges")!
  if (seq.items.length === 0) seq.flow = false
  if (seq.items.some((e) => edgeMatches(e, edge))) return text
  const item = doc.createNode(edge)
  if (isMap(item)) item.flow = true
  seq.add(item)
  return doc.toString()
}

export function removeEdge(text: string, edge: WorkflowEdge): string {
  const doc = parse(text)
  const seq = seqOf(doc, "edges")
  if (!seq) return text
  const idx = seq.items.findIndex((e) => edgeMatches(e, edge))
  if (idx < 0) return text
  seq.delete(idx)
  return doc.toString()
}

/**
 * Sets a top-level workflow key (`id`, `name`, `goal`); `undefined` deletes
 * it. A new `name` goes right after `id`, so the file reads top-down.
 */
export function setWorkflowField(
  text: string,
  field: "id" | "name" | "goal",
  value: unknown
): string {
  const doc = parse(text)
  if (value === undefined || value === null) {
    doc.deleteIn([field])
  } else if (field === "name" && isMap(doc.contents) && !doc.has("name")) {
    const map = doc.contents
    const at = map.items.findIndex(
      (p) => String((p.key as Scalar).value) === "id"
    )
    map.items.splice(at + 1, 0, doc.createPair("name", value))
  } else {
    doc.setIn([field], value)
  }
  return doc.toString()
}

/** Replaces a memory path in every node's `memory:` list (DES-013 rename). */
export function replaceMemoryRef(
  text: string,
  fromPath: string,
  toPath: string
): string {
  const doc = parse(text)
  const seq = seqOf(doc, "nodes")
  if (!seq) return text
  for (let i = 0; i < seq.items.length; i++) {
    const mem = doc.getIn(["nodes", i, "memory"])
    if (!isSeq(mem)) continue
    for (let j = 0; j < mem.items.length; j++) {
      const item = mem.items[j]
      const val = item instanceof Scalar ? String(item.value) : String(item)
      if (val !== fromPath) continue
      if (item instanceof Scalar) item.value = toPath
      else mem.set(j, toPath)
    }
  }
  return doc.toString()
}
