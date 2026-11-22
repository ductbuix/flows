import {
  isMap,
  isSeq,
  parseDocument,
  Scalar,
  YAMLMap,
  YAMLSeq,
  type Document,
} from "yaml"
import type { Need, Task } from "./workflow.ts"
import { taskIndex, tasksSeq } from "./workflow-yaml.ts"

function parse(text: string): Document {
  return parseDocument(text, { keepSourceTokens: true })
}

function emit(doc: Document): string {
  return doc.toString()
}

/**
 * Round-trip with no edits returns the input exactly (DES-013).
 * Parsing alone must not rewrite the file.
 */
export function roundTripYaml(text: string): string {
  parse(text)
  return text
}

export function addTask(text: string, task: Task): string {
  const doc = parse(text)
  let seq = tasksSeq(doc)
  if (!seq) {
    seq = new YAMLSeq()
    doc.set("tasks", seq)
  }
  seq.add(objectToYaml(task))
  return emit(doc)
}

export function removeTask(text: string, taskId: string): string {
  const doc = parse(text)
  const seq = tasksSeq(doc)
  const idx = taskIndex(doc, taskId)
  if (!seq || idx < 0) return text
  seq.delete(idx)
  // Drop needs that point at the removed task.
  for (const item of seq.items) {
    if (!isMap(item)) continue
    const needs = item.get("needs")
    if (!isSeq(needs)) continue
    for (let i = needs.items.length - 1; i >= 0; i--) {
      const n = needs.items[i]
      const id =
        typeof n === "string" || n instanceof Scalar
          ? String(n instanceof Scalar ? n.value : n)
          : isMap(n)
            ? String(n.get("task"))
            : null
      if (id === taskId) needs.delete(i)
    }
  }
  return emit(doc)
}

export function renameTask(text: string, fromId: string, toId: string): string {
  const doc = parse(text)
  const seq = tasksSeq(doc)
  const idx = taskIndex(doc, fromId)
  if (!seq || idx < 0) return text
  const map = seq.items[idx]
  if (!isMap(map)) return text
  map.set("id", toId)

  for (const item of seq.items) {
    if (!isMap(item)) continue
    const needs = item.get("needs")
    if (!isSeq(needs)) continue
    for (const n of needs.items) {
      if (typeof n === "string" || n instanceof Scalar) {
        const val = n instanceof Scalar ? n.value : n
        if (val === fromId) {
          if (n instanceof Scalar) n.value = toId
          else needs.set(needs.items.indexOf(n), toId)
        }
      } else if (isMap(n) && String(n.get("task")) === fromId) {
        n.set("task", toId)
      }
    }
  }
  return emit(doc)
}

export function setTaskNeeds(
  text: string,
  taskId: string,
  needs: Need[]
): string {
  const doc = parse(text)
  const idx = taskIndex(doc, taskId)
  if (idx < 0) return text
  doc.setIn(["tasks", idx, "needs"], needs.map(needToYaml))
  return emit(doc)
}

export function setRetryMax(text: string, taskId: string, max: number): string {
  const doc = parse(text)
  const idx = taskIndex(doc, taskId)
  if (idx < 0) return text
  const existing = doc.getIn(["tasks", idx, "retry"])
  if (isMap(existing)) {
    existing.set("max", max)
  } else {
    doc.setIn(["tasks", idx, "retry"], { max })
  }
  return emit(doc)
}

export function setApproval(
  text: string,
  taskId: string,
  approval: boolean
): string {
  const doc = parse(text)
  const idx = taskIndex(doc, taskId)
  if (idx < 0) return text
  if (approval) doc.setIn(["tasks", idx, "approval"], true)
  else doc.deleteIn(["tasks", idx, "approval"])
  return emit(doc)
}

export function setTaskField(
  text: string,
  taskId: string,
  field: string,
  value: unknown
): string {
  const doc = parse(text)
  const idx = taskIndex(doc, taskId)
  if (idx < 0) return text
  if (value === undefined || value === null) {
    doc.deleteIn(["tasks", idx, field])
  } else {
    doc.setIn(["tasks", idx, field], value)
  }
  return emit(doc)
}

export function setWorkflowField(
  text: string,
  field: "goal" | "limits" | "id" | "inputs" | "agent" | "name",
  value: unknown
): string {
  const doc = parse(text)
  if (
    field === "name" &&
    value !== undefined &&
    value !== null &&
    isMap(doc.contents) &&
    !doc.has("name")
  ) {
    // A new name sits right after id so the file reads top-down.
    const map = doc.contents
    const at = map.items.findIndex(
      (p) => String((p.key as Scalar).value) === "id"
    )
    map.items.splice(at + 1, 0, doc.createPair("name", value))
    return emit(doc)
  }
  if (value === undefined || value === null) doc.deleteIn([field])
  else doc.setIn([field], value)
  return emit(doc)
}

/** Replace one task map in place (promote / full task edit). */
export function upsertTask(text: string, task: Task): string {
  const doc = parse(text)
  let seq = tasksSeq(doc)
  if (!seq) {
    seq = new YAMLSeq()
    doc.set("tasks", seq)
  }
  const idx = taskIndex(doc, task.id)
  const node = objectToYaml(task)
  if (idx >= 0) seq.set(idx, node)
  else seq.add(node)
  return emit(doc)
}

function needToYaml(need: Need): unknown {
  if (typeof need === "string") return need
  return {
    task: need.task,
    ...(need.when ? { when: need.when } : {}),
    ...(need.allowSkipped !== undefined
      ? { allowSkipped: need.allowSkipped }
      : {}),
  }
}

function objectToYaml(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) {
    const seq = new YAMLSeq()
    for (const item of value) seq.add(objectToYaml(item))
    return seq
  }
  const map = new YAMLMap()
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue
    map.set(k, objectToYaml(v))
  }
  return map
}
