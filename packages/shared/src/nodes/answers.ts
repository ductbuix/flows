import type { AnswerDecl } from "./common.ts"

export { ANSWER_NAME_PATTERN, answersSchema, answerDeclSchema } from "./common.ts"
export type { AnswerDecl } from "./common.ts"

/** Answers are plain JSON values, one per declared name (DES-032). */
export type AnswerValues = Record<string, unknown>

export type AnswerParse =
  | { ok: true; value: AnswerValues }
  | { ok: false; error: string }

/** The one-line type hint shown to the model and in the Sheet. */
export function answerTypeHint(d: AnswerDecl): string {
  switch (d.type) {
    case "text":
      return "a string"
    case "number":
      return "a number"
    case "yesno":
      return "true or false"
    case "list":
      return "an array of strings"
    case "choice":
      return `one of ${(d.labels ?? []).map((l) => JSON.stringify(l)).join(", ")}`
  }
}

function checkOne(d: AnswerDecl, v: unknown): string | undefined {
  switch (d.type) {
    case "text":
      return typeof v === "string" ? undefined : "must be a string"
    case "number":
      return typeof v === "number" && Number.isFinite(v)
        ? undefined
        : "must be a number"
    case "yesno":
      return typeof v === "boolean" ? undefined : "must be true or false"
    case "list":
      return Array.isArray(v) && v.every((x) => typeof x === "string")
        ? undefined
        : "must be an array of strings"
    case "choice":
      return typeof v === "string" && (d.labels ?? []).includes(v)
        ? undefined
        : `must be one of ${(d.labels ?? []).join(", ")}`
  }
}

/**
 * Checks a parsed JSON value against the declared fields. Every declared
 * name must be present with the right type; extra keys are dropped.
 */
export function parseAnswer(
  decls: readonly AnswerDecl[],
  input: unknown
): AnswerParse {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "the answer must be a JSON object" }
  }
  const obj = input as Record<string, unknown>
  const problems: string[] = []
  const value: AnswerValues = {}
  for (const d of decls) {
    if (!(d.name in obj)) {
      problems.push(`${d.name}: missing`)
      continue
    }
    const bad = checkOne(d, obj[d.name])
    if (bad) problems.push(`${d.name}: ${bad}`)
    else value[d.name] = obj[d.name]
  }
  return problems.length > 0
    ? { ok: false, error: problems.join("; ") }
    : { ok: true, value }
}

/** Parses answer text: a bare JSON object, or the last JSON object in the text. */
export function parseAnswerText(
  decls: readonly AnswerDecl[],
  text: string
): AnswerParse {
  const candidates = answerJsonCandidates(text)
  let last: AnswerParse = { ok: false, error: "no JSON answer found" }
  for (const raw of candidates) {
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      continue
    }
    const parsed = parseAnswer(decls, json)
    if (parsed.ok) return parsed
    last = parsed
  }
  return last
}

/** Fenced blocks and the trimmed text, latest first. */
function answerJsonCandidates(text: string): string[] {
  const out: string[] = []
  const fence = /```(?:json)?\s*\n([\s\S]*?)```/gi
  for (const m of text.matchAll(fence)) out.push(m[1]!.trim())
  out.reverse()
  const trimmed = text.trim()
  out.push(trimmed)
  const open = trimmed.lastIndexOf("\n{")
  if (open >= 0) out.push(trimmed.slice(open + 1))
  return out
}

/** How a value reads inside a template or the step text. */
export function formatAnswerValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "yes" : "no"
  if (Array.isArray(v)) return v.map(String).join(", ")
  return String(v ?? "")
}

/** `name: value` lines, the step text of a node with answers. */
export function answerText(
  decls: readonly AnswerDecl[],
  value: AnswerValues
): string {
  return `${decls.map((d) => `${d.name}: ${formatAnswerValue(value[d.name])}`).join("\n")}\n`
}

const TEMPLATE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

/** Names used as `{{name}}` in a text, in first-use order. */
export function templateNames(text: string): string[] {
  return [...new Set([...text.matchAll(TEMPLATE)].map((m) => m[1]!))]
}

/** Fills `{{name}}`; a name with no value stays as written. */
export function fillTemplate(text: string, values: AnswerValues): string {
  return text.replace(TEMPLATE, (whole, name: string) =>
    name in values ? formatAnswerValue(values[name]) : whole
  )
}

type GraphNode = { id: string; kind: string; answers?: readonly AnswerDecl[] }
type GraphEdge = { from: string; to: string }

/** Declared answers of a node; only Agent and LLM carry them. */
export function declaredAnswers(node: GraphNode): readonly AnswerDecl[] {
  return node.answers ?? []
}

/** Ids of every node with a path to `id`, not counting `id` itself. */
function upstreamIds(edges: readonly GraphEdge[], id: string): Set<string> {
  const seen = new Set<string>()
  const todo = [id]
  while (todo.length > 0) {
    const at = todo.pop()!
    for (const e of edges) {
      if (e.to === at && !seen.has(e.from)) {
        seen.add(e.from)
        todo.push(e.from)
      }
    }
  }
  seen.delete(id)
  return seen
}

/**
 * For each answer name visible to a node, the upstream nodes that declare
 * it. One entry means the name resolves; two or more is ambiguous.
 */
export function upstreamAnswerSources(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  nodeId: string
): Map<string, string[]> {
  const up = upstreamIds(edges, nodeId)
  const out = new Map<string, string[]>()
  for (const n of nodes) {
    if (!up.has(n.id)) continue
    for (const d of declaredAnswers(n)) {
      out.set(d.name, [...(out.get(d.name) ?? []), n.id])
    }
  }
  return out
}

/** A text that may use `{{name}}`: a node setting or node file. */
export type TemplateText = { nodeId: string; label: string; text: string }

export type TemplateProblem = { nodeId: string; label: string; message: string }

/**
 * A name two upstream nodes declare is ambiguous and fails validation
 * (DES-032). A name nobody declares is left as written.
 */
export function templateProblems(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  texts: readonly TemplateText[]
): TemplateProblem[] {
  const out: TemplateProblem[] = []
  for (const t of texts) {
    const sources = upstreamAnswerSources(nodes, edges, t.nodeId)
    for (const name of templateNames(t.text)) {
      const from = sources.get(name) ?? []
      if (from.length > 1) {
        out.push({
          nodeId: t.nodeId,
          label: t.label,
          message: `{{${name}}} is ambiguous: ${from.join(" and ")} both declare it`,
        })
      }
    }
  }
  return out
}

/**
 * Values for a node's templates: each unambiguous upstream name takes the
 * answer of the node that declares it, as `answerOf` reports it.
 */
export function resolveAnswerValues(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  nodeId: string,
  answerOf: (nodeId: string) => AnswerValues | undefined
): AnswerValues {
  const out: AnswerValues = {}
  for (const [name, from] of upstreamAnswerSources(nodes, edges, nodeId)) {
    if (from.length !== 1) continue
    const v = answerOf(from[0]!)?.[name]
    if (v !== undefined) out[name] = v
  }
  return out
}
