import { z } from "zod"
import { workflowAgentSchema } from "../model-effort.ts"
import { timeoutSecondsSchema } from "../workflow.ts"
import { templateProblems, upstreamAnswerSources } from "./answers.ts"
import { judgeSettingProblems } from "./judge.ts"
import { nodeSchema, type WorkflowNode } from "./kinds.ts"
import { EDGE_LIMIT, NODE_LIMIT, nodeLimitsSchema } from "./limits.ts"
import {
  edgeProblems,
  edgeSchema,
  proposeConnectionsUpstream,
  type WorkflowEdge,
} from "./graph.ts"

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
    if (n.title !== undefined && n.target !== "notify") {
      out.push({
        message: "title is only for the notify target",
        path: ["nodes", i, "title"],
      })
    }
    if (n.channel !== undefined && n.target !== "notify") {
      out.push({
        message: "channel is only for the notify target",
        path: ["nodes", i, "channel"],
      })
    }
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
    if (
      !proposeConnectionsUpstream(wf.nodes, wf.edges, n.id).includes(
        n.connection
      )
    ) {
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
        ctx.addIssue({
          code: "custom",
          message: p.message,
          path: ["nodes", i, p.key],
        })
      }
      if (n.mode === "check" && n.check) {
        const from =
          upstreamAnswerSources(wf.nodes, wf.edges, n.id).get(n.check.field) ??
          []
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

export const workflowSchema = oldKeysGuard.pipe(nodeWorkflowObjectSchema)

export type Workflow = z.infer<typeof nodeWorkflowObjectSchema>
