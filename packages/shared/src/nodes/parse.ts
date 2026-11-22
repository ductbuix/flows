import { parseDocument, type Document } from "yaml"
import { nodeWorkflowSchema, type NodeWorkflow } from "./index.ts"

export type NodeYamlDiagnostic = {
  message: string
  path: (string | number)[]
  from: number
  to: number
  severity: "error"
}

export type ParsedNodeWorkflowYaml = {
  workflow: NodeWorkflow | null
  errors: NodeYamlDiagnostic[]
}

function range(
  doc: Document.Parsed,
  path: (string | number)[],
  len: number
): [number, number] {
  for (let i = path.length; i >= 0; i--) {
    const node = i === 0 ? doc.contents : doc.getIn(path.slice(0, i), true)
    if (node && typeof node === "object" && "range" in node && node.range) {
      const r = node.range as [number, number, number]
      return [r[0], Math.max(r[1], r[0] + 1)]
    }
  }
  return [0, Math.min(1, len)]
}

/** Parses a node workflow file; errors carry text ranges like the task format. */
export function parseNodeWorkflowYaml(text: string): ParsedNodeWorkflowYaml {
  const doc = parseDocument(text, { keepSourceTokens: true, strict: false })
  const errors: NodeYamlDiagnostic[] = []
  for (const err of doc.errors) {
    const from = Array.isArray(err.pos) ? (err.pos[0] ?? 0) : 0
    const to = Array.isArray(err.pos) ? (err.pos[1] ?? from) : from
    errors.push({
      message: err.message,
      path: [],
      from,
      to: Math.max(to, from + 1),
      severity: "error",
    })
  }
  if (errors.length > 0) return { workflow: null, errors }
  const parsed = nodeWorkflowSchema.safeParse(doc.toJS({ maxAliasCount: 1000 }))
  if (parsed.success) return { workflow: parsed.data, errors }
  for (const issue of parsed.error.issues) {
    const path = issue.path.filter(
      (p): p is string | number => typeof p === "string" || typeof p === "number"
    )
    const [from, to] = range(doc, path, text.length)
    errors.push({ message: issue.message, path, from, to, severity: "error" })
  }
  return { workflow: null, errors }
}
