import { zValidator } from "@hono/zod-validator"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { runDir, workflowDir, type Engine } from "@workspace/engine"
import {
  layoutFileSchema,
  NODE_KINDS,
  type LayoutFile,
  type RunCanvas,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import { readLayout, writeLayout } from "./layout-files.ts"
import { workflowYamlPath } from "./workflow-files.ts"
import { existsSync } from "node:fs"

const param = z.object({ workflowId: z.string().min(1) })

function readFrozen(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return undefined
  }
}

/** The run's frozen layout and node text, as `startNodeRun` copied them. */
function runCanvas(engine: Engine, runId: string): RunCanvas | null {
  const state = engine.fold(runId)
  if (!state || state.deleted || !state.graph) return null
  const root = runDir(workflowDir(engine.home, state.workflowId), runId)
  let layout: LayoutFile = { version: 1, nodes: {} }
  try {
    layout = layoutFileSchema.parse(
      JSON.parse(readFileSync(join(root, "layout.json"), "utf8"))
    )
  } catch {
    // No layout was saved: the web places the nodes.
  }
  const texts: Record<string, string> = {}
  for (const node of state.graph.nodes) {
    const file = NODE_KINDS.find((k) => k.kind === node.kind)?.files[0]
    if (!file) continue
    const text = readFrozen(join(root, "nodes", node.id, "frozen", file.path))
    if (text !== undefined) texts[`nodes/${node.id}/${file.path}`] = text
  }
  return { workflow: state.graph, layout, texts }
}

/** GET/PUT /workflows/:id/layout (BL-092) and GET /runs/:id/canvas (BL-087). */
export function layoutRoutes(engine: Engine) {
  return new Hono()
    .get(
      "/runs/:runId/canvas",
      zValidator("param", z.object({ runId: z.string().min(1) })),
      (c) => {
        const canvas = runCanvas(engine, c.req.valid("param").runId)
        if (!canvas) return c.json({ message: "run not found" }, 404)
        return c.json(canvas, 200)
      }
    )
    .get("/workflows/:workflowId/layout", zValidator("param", param), (c) => {
      const { workflowId } = c.req.valid("param")
      if (!existsSync(workflowYamlPath(engine, workflowId))) {
        return c.json({ message: "workflow not found" }, 404)
      }
      return c.json(readLayout(engine, workflowId), 200)
    })
    .put(
      "/workflows/:workflowId/layout",
      zValidator("param", param),
      zValidator("json", layoutFileSchema),
      (c) => {
        const { workflowId } = c.req.valid("param")
        const written = writeLayout(engine, workflowId, c.req.valid("json"))
        if (!written) return c.json({ message: "workflow not found" }, 404)
        return c.json(written, 200)
      }
    )
}
