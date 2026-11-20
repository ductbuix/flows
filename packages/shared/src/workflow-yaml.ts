import {
  isMap,
  isSeq,
  parseDocument,
  type Document,
  type YAMLMap,
  type YAMLSeq,
} from "yaml"
import { workflowSchema, type Task, type Workflow } from "./workflow.ts"

export type YamlDiagnostic = {
  message: string
  path: (string | number)[]
  from: number
  to: number
  severity: "error"
}

export type ParsedWorkflowYaml = {
  doc: Document.Parsed
  text: string
  workflow: Workflow | null
  errors: YamlDiagnostic[]
}

export function parseWorkflowYaml(text: string): ParsedWorkflowYaml {
  const doc = parseDocument(text, {
    keepSourceTokens: true,
    strict: false,
  })
  const errors: YamlDiagnostic[] = []

  for (const err of doc.errors) {
    const pos = err.pos
    const from = Array.isArray(pos) ? (pos[0] ?? 0) : 0
    const to = Array.isArray(pos) ? (pos[1] ?? from) : from
    errors.push({
      message: err.message,
      path: [],
      from,
      to: Math.max(to, from + 1),
      severity: "error",
    })
  }

  const raw = doc.toJS({ maxAliasCount: 1000 })
  const parsed = workflowSchema.safeParse(raw)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.filter(
        (p): p is string | number =>
          typeof p === "string" || typeof p === "number"
      )
      const range = rangeForPath(doc, path, text.length)
      errors.push({
        message: issue.message,
        path,
        from: range[0],
        to: range[1],
        severity: "error",
      })
    }
    return { doc, text, workflow: null, errors }
  }

  return {
    doc,
    text,
    workflow: parsed.data,
    errors,
  }
}

function rangeForPath(
  doc: Document.Parsed,
  path: (string | number)[],
  fallbackLen: number
): [number, number] {
  if (path.length === 0) {
    const r = doc.contents?.range
    return r ? [r[0], r[1]] : [0, Math.min(1, fallbackLen)]
  }
  const node = doc.getIn(path, true)
  if (node && typeof node === "object" && "range" in node && node.range) {
    const r = node.range as [number, number, number]
    return [r[0], r[1]]
  }
  // Walk parents for a usable range.
  for (let i = path.length - 1; i >= 0; i--) {
    const parent = doc.getIn(path.slice(0, i), true)
    if (parent && typeof parent === "object" && "range" in parent && parent.range) {
      const r = parent.range as [number, number, number]
      return [r[0], r[1]]
    }
  }
  return [0, Math.min(1, fallbackLen)]
}

export function tasksSeq(doc: Document): YAMLSeq | null {
  const tasks = doc.getIn(["tasks"])
  return isSeq(tasks) ? tasks : null
}

export function taskIndex(doc: Document, taskId: string): number {
  const seq = tasksSeq(doc)
  if (!seq) return -1
  return seq.items.findIndex((item) => {
    if (!isMap(item)) return false
    return String(item.get("id")) === taskId
  })
}

export function taskMap(doc: Document, taskId: string): YAMLMap | null {
  const seq = tasksSeq(doc)
  const idx = taskIndex(doc, taskId)
  if (!seq || idx < 0) return null
  const item = seq.items[idx]
  return isMap(item) ? item : null
}

export function stripSpawnMeta(task: Task): Task {
  const rest = { ...task }
  delete rest.spawnDepth
  delete rest.spawnedBy
  return rest
}
