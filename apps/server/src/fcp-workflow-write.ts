import {
  defineBinding,
  engineError,
  type MethodBindings,
  type UpdateBus,
} from "@workspace/core"
import {
  parseNodeWorkflowYaml,
  workflowCreateMethod,
  workflowDeleteMethod,
  workflowRenameMethod,
  workflowSaveLayoutMethod,
  workflowSaveMethod,
  workflowSummarySchema,
  workflowValidateMethod,
  type WorkflowSummary,
} from "@workspace/contracts"
import type { Engine } from "@workspace/engine"
import { writeLayout } from "./layout-files.ts"
import {
  readNodeWorkflowDetail,
  writeNodeWorkflowYaml,
} from "./node-workflow-files.ts"
import {
  createWorkflow,
  deleteWorkflow,
  renameWorkflow,
} from "./workflow-lifecycle.ts"
import { listWorkflowSummaries } from "./workflows-fs.ts"

export type WorkflowWriteBindings = Pick<
  MethodBindings,
  | "workflow/create"
  | "workflow/save"
  | "workflow/rename"
  | "workflow/delete"
  | "workflow/save_layout"
  | "workflow/validate"
>

export type WorkflowWriteDeps = {
  engine: Engine
  bus: UpdateBus
}

export function createWorkflowWriteBindings(
  deps: WorkflowWriteDeps
): WorkflowWriteBindings {
  const { engine, bus } = deps
  return {
    "workflow/create": defineBinding(workflowCreateMethod, (params) => {
      const result = createWorkflow(engine, params.id, params.goal, params.name)
      if (result.ok === false) {
        if (result.kind === "exists") {
          throw engineError("conflict", `Workflow already exists: ${params.id}`)
        }
        throw engineError("invalid_params", `Invalid workflow id: ${params.id}`)
      }
      const summary = workflowSummarySchema.parse(result.summary)
      bus.publish("workflow/update", {
        kind: "workflow_changed",
        workflowId: summary.id,
        summary,
      })
      return summary
    }),
    "workflow/save": defineBinding(workflowSaveMethod, (params) => {
      const result = writeNodeWorkflowYaml(
        engine,
        params.id,
        params.yaml,
        params.baseHash,
        params.renames ?? []
      )
      if (result.ok === false && result.kind === "not_found") {
        throw engineError("not_found", `Workflow not found: ${params.id}`)
      }
      if (result.ok === false && result.kind === "conflict") {
        throw engineError("conflict", "Stale baseHash", {
          current: { yaml: result.diskYaml, hash: result.diskHash },
        })
      }
      if (result.ok === false && result.kind === "invalid") {
        throw engineError("invalid_params", "Invalid workflow yaml", {
          detail: result.detail,
        })
      }
      if (result.ok === false && result.kind === "trash_failed") {
        throw engineError("internal", "Failed to move removed task folder", {
          path: result.path,
        })
      }
      publishWorkflowChanged(deps, params.id)
      return result.detail
    }),
    "workflow/rename": defineBinding(workflowRenameMethod, (params) => {
      const result = renameWorkflow(engine, params.id, params.newId)
      if (result.ok === false) {
        if (result.kind === "not_found") {
          throw engineError("not_found", `Workflow not found: ${params.id}`)
        }
        if (result.kind === "live") {
          throw engineError("busy", `Workflow has a live run: ${params.id}`)
        }
        if (result.kind === "exists") {
          throw engineError(
            "conflict",
            `Workflow already exists: ${params.newId}`
          )
        }
        throw engineError(
          "invalid_params",
          `Invalid workflow id: ${params.newId}`
        )
      }
      if (params.id !== result.id) {
        bus.publish("workflow/update", {
          kind: "workflow_removed",
          workflowId: params.id,
        })
      }
      publishWorkflowChanged(deps, result.id!)
      return { id: result.id! }
    }),
    "workflow/delete": defineBinding(workflowDeleteMethod, (params) => {
      const result = deleteWorkflow(engine, params.id)
      if (result.ok === false) {
        if (result.kind === "not_found") {
          throw engineError("not_found", `Workflow not found: ${params.id}`)
        }
        if (result.kind === "live") {
          throw engineError("busy", `Workflow has a live run: ${params.id}`)
        }
        throw engineError("invalid_params", result.kind)
      }
      bus.publish("workflow/update", {
        kind: "workflow_removed",
        workflowId: params.id,
      })
      return {}
    }),
    "workflow/save_layout": defineBinding(
      workflowSaveLayoutMethod,
      (params) => {
        const written = writeLayout(engine, params.id, params.layout)
        if (!written) {
          throw engineError("not_found", `Workflow not found: ${params.id}`)
        }
        bus.publish("workflow/update", {
          kind: "layout_changed",
          workflowId: params.id,
          layout: written,
        })
        return written
      }
    ),
    "workflow/validate": defineBinding(workflowValidateMethod, (params) => {
      const parsed = parseNodeWorkflowYaml(params.yaml)
      return { workflow: parsed.workflow, errors: parsed.errors }
    }),
  }
}

function publishWorkflowChanged(
  deps: WorkflowWriteDeps,
  workflowId: string
): void {
  const summary = summaryOf(deps.engine, workflowId)
  if (!summary) return
  deps.bus.publish("workflow/update", {
    kind: "workflow_changed",
    workflowId,
    summary,
  })
}

function summaryOf(engine: Engine, workflowId: string): WorkflowSummary | null {
  const fromList = listWorkflowSummaries(engine).find(
    (w) => w.id === workflowId
  )
  if (fromList) return workflowSummarySchema.parse(fromList)
  const detail = readNodeWorkflowDetail(engine, workflowId)
  if (!detail?.workflow) return null
  return workflowSummarySchema.parse({
    id: workflowId,
    ...(detail.workflow.name ? { name: detail.workflow.name } : {}),
    ...(detail.workflow.goal ? { goal: detail.workflow.goal } : {}),
    taskCount: detail.workflow.nodes.length,
  })
}
