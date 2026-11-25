import type { AcpInboxGates } from "../agents/acp-inbox-answer.ts"
import { acpSessionHandlers } from "../agents/acp-session-handlers.ts"
import { appendLogEntry } from "./attempt-log.ts"
import type { AgentRuntime } from "../ports/agent-runtime.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import type { PublishPort } from "../ports/publish.ts"
import type { InputSource } from "./input-sources.ts"
import { AskPending, type StepContext, type StepInput } from "./types.ts"

export type StepContextDeps = {
  docs: DocumentStore
  runDir: string
  nodeId: string
  pass: number
  /** Attempt number; unset skips the activity log. */
  attempt?: number
  settings: unknown
  inputs: readonly StepInput[]
  answers?: Record<string, unknown>
  decision?: "approved" | "rejected"
  graph: { id: string; name?: string }
  nodeName?: string
  signal?: AbortSignal
  /** When set, `inbox.ask` returns it; otherwise throws AskPending. */
  resolveAsk?: "approved" | "rejected"
  /** Absolute cwd for agent sessions (defaults to stepDir). */
  agentCwd?: string
  /** Required for llm / condition kinds (DES-041). */
  agentRuntime?: AgentRuntime
  /** Run id for ACP inbox events (BL-195). */
  runId?: string
  /** Live ACP ask gates; wires permission/question/plan handlers. */
  acpAsks?: AcpInboxGates
  /** Cursor create_plan review mode from the llm node. */
  planReview?: "auto" | "ask"
  /** Connector publish for output target=publish (BL-195). */
  publish?: PublishPort
}

/** Build a StepContext over a DocumentStore (tests use the fake). */
export function createStepContext<S>(
  deps: StepContextDeps & { settings: S }
): StepContext<S> {
  const stepDir = `${deps.runDir}/nodes/${deps.nodeId}/pass-${deps.pass}`
  const signal = deps.signal ?? new AbortController().signal
  // Ensure the step folder exists before ACP opens with it as cwd (BL-195).
  deps.docs.write(`${stepDir}/.keep`, "")

  const ctx: StepContext<S> = {
    settings: deps.settings,
    inputs: deps.inputs,
    runDir: deps.runDir,
    stepDir,
    signal,
    answers: deps.answers ?? {},
    decision: deps.decision,
    ...(deps.runId !== undefined ? { runId: deps.runId } : {}),
    graph: deps.graph,
    node: { id: deps.nodeId, name: deps.nodeName, pass: deps.pass },
    inbox: {
      async ask(question: string) {
        if (deps.resolveAsk) return deps.resolveAsk
        if (deps.decision) return deps.decision
        throw new AskPending(question)
      },
    },
    agent: {
      async session(spec) {
        if (!deps.agentRuntime) {
          throw new Error("agent runtime is not configured")
        }
        const cwd = deps.agentCwd || spec.cwd || stepDir
        const handlers =
          deps.acpAsks && deps.runId
            ? acpSessionHandlers({
                runId: deps.runId,
                nodeId: deps.nodeId,
                pass: deps.pass,
                attemptRoot: cwd,
                gates: deps.acpAsks,
                ...(deps.planReview !== undefined
                  ? { planReview: deps.planReview }
                  : {}),
              })
            : {}
        return deps.agentRuntime.open(
          {
            ...spec,
            ...handlers,
            cwd,
          },
          signal
        )
      },
    },
    log(entry) {
      if (deps.attempt === undefined) return
      appendLogEntry(deps.docs, `${stepDir}/attempt-${deps.attempt}`, entry)
    },
    outputs: {
      async write(relPath: string, text: string) {
        const path = `${stepDir}/${relPath}`.replace(/\/+/g, "/")
        deps.docs.write(path, text)
        return `nodes/${deps.nodeId}/pass-${deps.pass}/${relPath}`
      },
    },
    docs: {
      read(path: string) {
        const got = deps.docs.read(path)
        return got ? { text: got.text } : null
      },
      list(glob: string) {
        return deps.docs.list(glob)
      },
      write(path: string, text: string) {
        deps.docs.write(path, text)
      },
      remove(path: string) {
        deps.docs.remove(path)
      },
    },
    ...(deps.publish ? { publish: deps.publish } : {}),
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

/**
 * Load the results of upstream steps as StepInputs (DES-034). A step's
 * results are the files its `step_done` recorded plus its `files/**`;
 * attempt logs, scratch files and the agent's own workspace are never
 * inputs. Without recorded outputs only `text.md` is read.
 */
export function loadStepInputs(
  docs: DocumentStore,
  runDir: string,
  sources: readonly InputSource[]
): StepInput[] {
  const out: StepInput[] = []
  for (const src of sources) {
    const base = `nodes/${src.from}/pass-${src.pass}`
    const names = new Set<string>()
    for (const rel of src.outputs ?? [`${base}/text.md`]) {
      if (rel.startsWith(`${base}/`)) names.add(rel.slice(base.length + 1))
    }
    const filesRoot = `${runDir}/${base}/files/`
    for (const path of docs.list(`${runDir}/${base}/files/**`)) {
      if (path.startsWith(filesRoot) && !path.endsWith("/")) {
        names.add(path.slice(runDir.length + base.length + 2))
      }
    }
    for (const name of [...names].sort(byResultFirst)) {
      const path = `${runDir}/${base}/${name}`
      const read = docs.read(path)
      if (!read) continue
      out.push({ from: src.from, path, name, text: read.text, role: src.role })
    }
  }
  return out
}

function byResultFirst(a: string, b: string): number {
  if (a === "text.md") return -1
  if (b === "text.md") return 1
  return a.localeCompare(b)
}
