import { connectionEnvName, type WorkflowNode } from "@workspace/contracts"
import { appendLogEntry } from "./attempt-log.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import type { ProcessRunner } from "../ports/process-runner.ts"
import type { EffectResult, RunEffect, RunState } from "../runs/model.ts"

export type CommandEffectDeps = {
  docs: DocumentStore
  process: ProcessRunner
  runDirOf: (state: RunState) => string
  workflowDirOf: (state: RunState) => string
  /**
   * Map a store path to an absolute filesystem path for spawn cwd /
   * `NODE_OUT` (host: join with FLOWAPP_HOME).
   */
  absolutePathOf?: (storePath: string) => string
  /** Merged under NODE_* / RUN_* / WF_DIR (host passes `process.env`). */
  baseEnv?: Readonly<Record<string, string | undefined>>
  /** When aborted, spawn is killed and the effect throws AbortError. */
  signalOf?: (state: RunState) => AbortSignal | undefined
  now?: () => string
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  if (chunks.length === 0) return ""
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder().decode(merged)
}

/**
 * Shell-owned command launch (DES-041 process kinds). Spawns `node.run`
 * in the workflow dir; stdout → `text.md`, `NODE_OUT` files → `files/`.
 */
export async function runCommandEffect(
  effect: Extract<RunEffect, { kind: "launch_step" }>,
  state: RunState,
  deps: CommandEffectDeps
): Promise<EffectResult> {
  const node = state.graph.nodes.find((n) => n.id === effect.nodeId)
  if (!node || node.kind !== "command") {
    return { ok: false, reason: "exit" }
  }
  const run = "run" in node && typeof node.run === "string" ? node.run : ""
  if (!run) return { ok: false, reason: "exit" }

  const now = deps.now ?? (() => new Date().toISOString())
  const abs = deps.absolutePathOf ?? ((p: string) => p)
  const runDir = deps.runDirOf(state)
  const workflowDir = deps.workflowDirOf(state)
  const stepDir = `${runDir}/nodes/${effect.nodeId}/pass-${effect.pass}`
  const attemptRoot = `${stepDir}/attempt-${effect.attempt}`
  const outDir = `${attemptRoot}/out`
  deps.docs.write(`${outDir}/.keep`, "")

  const workflowAbs = abs(workflowDir)
  const outAbs = abs(outDir)
  const runAbs = abs(runDir)
  const startedAt = now()
  const signal = deps.signalOf?.(state) ?? new AbortController().signal
  const proc = deps.process.spawn(
    {
      command: "/bin/sh",
      args: ["-c", run],
      cwd: workflowAbs,
      env: {
        ...deps.baseEnv,
        ...assetResourceEnv(state, effect.nodeId, runAbs),
        RUN_ID: state.runId,
        WF_DIR: workflowAbs,
        NODE_ID: effect.nodeId,
        NODE_OUT: outAbs,
      },
    },
    signal
  )

  const stdoutP = readAll(proc.stdout)
  const stderrP = readAll(proc.stderr)
  const code = await proc.exit
  const stdout = await stdoutP
  const stderr = await stderrP
  // Keep full logs per attempt so the canvas can show them (run/get_log).
  deps.docs.write(`${attemptRoot}/stdout.log`, stdout)
  deps.docs.write(`${attemptRoot}/stderr.log`, stderr)
  appendLogEntry(deps.docs, attemptRoot, {
    at: startedAt,
    kind: "command",
    title: run,
    command: run,
    status: code === 0 ? "ok" : "failed",
    text: [stdout, stderr].filter((t) => t.trim()).join("\n"),
  })

  // Let a queued cancel settle the run (do not emit step_failed first).
  if (signal.aborted) {
    throw new DOMException("cancelled", "AbortError")
  }

  if (code !== 0) {
    return {
      ok: false,
      reason: "exit",
      attempt: {
        attempt: effect.attempt,
        exitCode: code,
        endedAt: now(),
      },
    }
  }

  const textRel = `nodes/${effect.nodeId}/pass-${effect.pass}/text.md`
  deps.docs.write(`${stepDir}/text.md`, stdout)
  const outputs = [textRel]

  const outPrefix = `${outDir}/`
  for (const path of deps.docs.list(`${outDir}/**`)) {
    if (!path.startsWith(outPrefix)) continue
    const name = path.slice(outPrefix.length)
    if (!name || name === ".keep" || name.endsWith("/")) continue
    const body = deps.docs.read(path)
    if (!body) continue
    const dest = `${stepDir}/files/${name}`
    deps.docs.write(dest, body.text)
    outputs.push(`nodes/${effect.nodeId}/pass-${effect.pass}/files/${name}`)
  }

  return { ok: true, outputs }
}

/** Upstream Asset → RESOURCE_* env; propose uses work/, else resources/ (BL-084). */
function assetResourceEnv(
  state: RunState,
  nodeId: string,
  runRootAbs: string
): Record<string, string> {
  const up = ancestorsOf(state.graph.edges, nodeId)
  const env: Record<string, string> = {}
  for (const node of state.graph.nodes) {
    if (node.kind !== "asset" || !up.has(node.id)) continue
    const folder = assetAccess(node) === "propose" ? "work" : "resources"
    for (const r of node.resources ?? []) {
      env[connectionEnvName(r.connection)] =
        `${runRootAbs}/${folder}/${r.connection}`
    }
  }
  return env
}

function assetAccess(node: WorkflowNode): "read" | "propose" {
  if (node.kind !== "asset") return "read"
  return node.access === "propose" ? "propose" : "read"
}

function ancestorsOf(
  edges: readonly { from: string; to: string }[],
  id: string
): Set<string> {
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
  return seen
}
