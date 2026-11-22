import { z } from "zod"
import { workflowAgentSchema } from "../model-effort.ts"
import { timeoutSecondsSchema } from "../workflow.ts"
import { agentKind } from "./agent.ts"
import { approvalKind } from "./approval.ts"
import { assetKind } from "./asset.ts"
import { commandKind } from "./command.ts"
import type { PortType } from "./define.ts"
import { templateProblems, upstreamAnswerSources } from "./answers.ts"
import { judgeKind, judgeSettingProblems } from "./judge.ts"
import { llmKind } from "./llm.ts"
import { outputKind } from "./output.ts"
import { promptKind } from "./prompt.ts"
import { triggerKind } from "./trigger.ts"

export { assetResourceSchema, type AssetResource } from "./asset.ts"
export { defineNodeKind, nodeIdSchema } from "./define.ts"
export type { NodeGroup, NodeKindDef, PortType } from "./define.ts"

/** The one list of kinds; schema, ports and checks read it (DES-035). */
export const NODE_KINDS = [
  triggerKind,
  promptKind,
  assetKind,
  agentKind,
  commandKind,
  llmKind,
  judgeKind,
  approvalKind,
  outputKind,
] as const

export type NodeKindName = (typeof NODE_KINDS)[number]["kind"]

export const NODE_LIMIT = 200
export const EDGE_LIMIT = 400
export const DEFAULT_LOOP_PASSES = 5

/** Old task-format keys, checked in this order (DES-033). */
export const OLD_WORKFLOW_KEYS = [
  "tasks",
  "needs",
  "when",
  "repeat",
  "approval",
  "spawn",
  "uses",
] as const

export const nodeSchema = z.discriminatedUnion(
  "kind",
  NODE_KINDS.map((k) => k.schema) as unknown as [
    (typeof NODE_KINDS)[number]["schema"],
    ...(typeof NODE_KINDS)[number]["schema"][],
  ]
)

export type WorkflowNode = z.infer<typeof nodeSchema>

export const portTypeSchema = z.enum(["text", "file"])

export const edgeSchema = z.strictObject({
  from: z.string().min(1),
  to: z.string().min(1),
  port: portTypeSchema.optional(),
  branch: z.string().min(1).optional(),
})

export type WorkflowEdge = z.infer<typeof edgeSchema>

export const nodeLimitsSchema = z.strictObject({
  concurrency: z.number().int().positive().optional(),
  agents: z.number().int().positive().optional(),
  maxConcurrentRuns: z.number().int().positive().optional(),
  /** Loop passes before a cycle stops (DES-034); default 5. */
  loopPasses: z.number().int().positive().default(DEFAULT_LOOP_PASSES),
})

export type NodePorts = {
  in: readonly PortType[]
  out: readonly PortType[]
  branches?: readonly string[]
}

/** The port table: kind name to its ports. */
export const PORT_TABLE: Record<string, NodePorts> = Object.fromEntries(
  NODE_KINDS.map((k) => [
    k.kind,
    { in: k.ports.in, out: k.ports.out, branches: k.branches },
  ])
)

/** Problems with edges against nodes; one message each. */
export function edgeProblems(
  nodes: readonly { id: string; kind: string }[],
  edges: readonly WorkflowEdge[]
): { index: number; message: string }[] {
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]))
  const seen = new Set<string>()
  const out: { index: number; message: string }[] = []
  edges.forEach((e, index) => {
    const add = (message: string) => out.push({ index, message })
    const fromKind = kindOf.get(e.from)
    const toKind = kindOf.get(e.to)
    if (!fromKind) add(`unknown node id ${e.from}`)
    if (!toKind) add(`unknown node id ${e.to}`)
    const port = e.port ?? "text"
    if (fromKind) {
      const p = PORT_TABLE[fromKind]!
      if (p.branches) {
        if (!e.branch || !p.branches.includes(e.branch)) {
          add(`edge out of ${fromKind} needs branch ${p.branches.join(" or ")}`)
        }
      } else if (e.branch !== undefined) {
        add(`branch is not allowed on edges out of ${fromKind}`)
      }
      if (!p.branches && !p.out.includes(port)) {
        add(`${fromKind} has no out port ${port}`)
      }
    }
    if (toKind && !PORT_TABLE[toKind]!.in.includes(port)) {
      add(`${toKind} has no in port ${port}`)
    }
    const key = `${e.from}|${e.to}|${port}|${e.branch ?? ""}`
    if (seen.has(key)) add("duplicate edge")
    seen.add(key)
  })
  return out
}

/** Ids of every node with a path to `id`, along any port. */
function ancestorsOf(
  edges: readonly WorkflowEdge[],
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

/** Connections an Asset with `propose` access offers upstream of a node (BL-084). */
export function proposeConnectionsUpstream(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  nodeId: string
): string[] {
  const up = ancestorsOf(edges, nodeId)
  const found = new Set<string>()
  for (const a of nodes) {
    if (a.kind !== "asset" || a.access !== "propose" || !up.has(a.id)) continue
    for (const r of a.resources) found.add(r.connection)
  }
  return [...found].sort()
}

/**
 * Output settings that depend on the graph (BL-084): `connection` goes with
 * `publish` only, and a publish needs an upstream Asset that lists a
 * resource of that connection with `propose` access.
 */
function outputProblems(wf: {
  nodes: readonly WorkflowNode[]
  edges: readonly WorkflowEdge[]
}): { message: string; path: (string | number)[] }[] {
  const out: { message: string; path: (string | number)[] }[] = []
  wf.nodes.forEach((n, i) => {
    if (n.kind !== "output") return
    if (n.target !== "publish") {
      if (n.connection !== undefined) {
        out.push({
          message: "connection is only for the publish target",
          path: ["nodes", i, "connection"],
        })
      }
      return
    }
    if (n.connection === undefined) {
      out.push({
        message: "publish needs a connection",
        path: ["nodes", i, "connection"],
      })
      return
    }
    if (!proposeConnectionsUpstream(wf.nodes, wf.edges, n.id).includes(n.connection)) {
      out.push({
        message: `publish to ${n.connection} needs an upstream Asset with propose access to it`,
        path: ["nodes", i, "connection"],
      })
    }
  })
  return out
}

const nodeWorkflowObjectSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(80).optional(),
    goal: z.string().optional(),
    limits: nodeLimitsSchema.optional(),
    timeout: timeoutSecondsSchema.optional(),
    agent: workflowAgentSchema.optional(),
    nodes: z.array(nodeSchema).max(NODE_LIMIT),
    edges: z.array(edgeSchema).max(EDGE_LIMIT).default([]),
  })
  .superRefine((wf, ctx) => {
    const ids = new Set<string>()
    wf.nodes.forEach((n, i) => {
      if (ids.has(n.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate node id ${n.id}`,
          path: ["nodes", i, "id"],
        })
      }
      ids.add(n.id)
    })
    const questions = wf.nodes.flatMap((n) =>
      n.kind === "approval"
        ? [{ nodeId: n.id, label: "question", text: n.question }]
        : []
    )
    templateProblems(wf.nodes, wf.edges, questions).forEach((p) => {
      const at = wf.nodes.findIndex((n) => n.id === p.nodeId)
      ctx.addIssue({
        code: "custom",
        message: `${p.label}: ${p.message}`,
        path: ["nodes", at, "question"],
      })
    })
    wf.nodes.forEach((n, i) => {
      if (n.kind !== "judge") return
      for (const p of judgeSettingProblems(n)) {
        ctx.addIssue({ code: "custom", message: p.message, path: ["nodes", i, p.key] })
      }
      if (n.mode === "check" && n.check) {
        const from = upstreamAnswerSources(wf.nodes, wf.edges, n.id).get(n.check.field) ?? []
        if (from.length !== 1) {
          ctx.addIssue({
            code: "custom",
            message:
              from.length === 0
                ? `check field ${n.check.field}: no upstream node declares it`
                : `check field ${n.check.field} is ambiguous: ${from.join(" and ")} both declare it`,
            path: ["nodes", i, "check", "field"],
          })
        }
      }
    })
    outputProblems(wf).forEach((p) => ctx.addIssue({ code: "custom", ...p }))
    for (const p of edgeProblems(wf.nodes, wf.edges)) {
      ctx.addIssue({
        code: "custom",
        message: p.message,
        path: ["edges", p.index],
      })
    }
  })

/** Rejects the old task format with an error naming the first old key. */
const oldKeysGuard = z.unknown().check((ctx) => {
  const v = ctx.value
  if (typeof v !== "object" || v === null) return
  const key = OLD_WORKFLOW_KEYS.find((k) => k in v)
  if (key) {
    ctx.issues.push({
      code: "custom",
      message: `old workflow format: key "${key}" is not supported; use nodes and edges`,
      input: ctx.value,
      continue: false,
    })
  }
})

export const nodeWorkflowSchema = oldKeysGuard.pipe(nodeWorkflowObjectSchema)

export type NodeWorkflow = z.infer<typeof nodeWorkflowObjectSchema>
