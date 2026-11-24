import type { DocumentStore } from "../ports/document-store.ts"
import { AskPending, type StepContext, type StepInput } from "./types.ts"

export type StepContextDeps = {
  docs: DocumentStore
  runDir: string
  nodeId: string
  pass: number
  settings: unknown
  inputs: readonly StepInput[]
  answers?: Record<string, unknown>
  decision?: "approved" | "rejected"
  graph: { id: string; name?: string }
  nodeName?: string
  signal?: AbortSignal
  /** When set, `inbox.ask` returns it; otherwise throws AskPending. */
  resolveAsk?: "approved" | "rejected"
}

/** Build a StepContext over a DocumentStore (tests use the fake). */
export function createStepContext<S>(
  deps: StepContextDeps & { settings: S }
): StepContext<S> {
  const stepDir = `${deps.runDir}/nodes/${deps.nodeId}/pass-${deps.pass}`

  const ctx: StepContext<S> = {
    settings: deps.settings,
    inputs: deps.inputs,
    runDir: deps.runDir,
    stepDir,
    signal: deps.signal ?? new AbortController().signal,
    answers: deps.answers ?? {},
    decision: deps.decision,
    graph: deps.graph,
    node: { id: deps.nodeId, name: deps.nodeName, pass: deps.pass },
    inbox: {
      async ask(question: string) {
        if (deps.resolveAsk) return deps.resolveAsk
        if (deps.decision) return deps.decision
        throw new AskPending(question)
      },
    },
    outputs: {
      async write(relPath: string, text: string) {
        const path = `${stepDir}/${relPath}`.replace(/\/+/g, "/")
        deps.docs.write(path, text)
        return `nodes/${deps.nodeId}/pass-${deps.pass}/${relPath}`
      },
    },
  }
  return ctx
}

/** Load run `input/` files as StepInputs (trigger). */
export function loadRunInputs(
  docs: DocumentStore,
  runDir: string
): StepInput[] {
  const prefix = `${runDir}/input/`
  const out: StepInput[] = []
  for (const path of docs.list(`${runDir}/input/**`)) {
    if (!path.startsWith(prefix) && path !== `${runDir}/input`) continue
    const name = path.slice(prefix.length)
    if (!name || name.endsWith("/")) continue
    const read = docs.read(path)
    out.push({
      from: "input",
      path,
      name,
      ...(read ? { text: read.text } : {}),
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Load files from upstream step folders as StepInputs. */
export function loadStepInputs(
  docs: DocumentStore,
  runDir: string,
  fromIds: readonly string[],
  passOf: (id: string) => number
): StepInput[] {
  const out: StepInput[] = []
  for (const from of fromIds) {
    const pass = passOf(from)
    const base = `${runDir}/nodes/${from}/pass-${pass}`
    for (const path of docs.list(`${base}/**`)) {
      if (!path.startsWith(`${base}/`)) continue
      const name = path.slice(base.length + 1)
      if (!name || name.endsWith("/")) continue
      const read = docs.read(path)
      out.push({
        from,
        path,
        name,
        ...(read ? { text: read.text } : {}),
      })
    }
  }
  return out
}
