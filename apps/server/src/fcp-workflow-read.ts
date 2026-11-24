import {
  workflowGetMethod,
  workflowListMethod,
  workflowSummarySchema,
  type WorkflowSummary,
} from "@workspace/contracts"
import {
  defineBinding,
  engineError,
  type MethodBindings,
} from "@workspace/core"
import type { Engine } from "@workspace/adapters-node"
import { readNodeWorkflowDetail } from "./node-workflow-files.ts"
import { listWorkflowSummaries } from "./workflows-fs.ts"

const DEFAULT_LIST_LIMIT = 100

export type WorkflowReadBindings = Pick<
  MethodBindings,
  "workflow/list" | "workflow/get"
>

export function createWorkflowReadBindings(
  engine: Engine
): WorkflowReadBindings {
  return {
    "workflow/list": defineBinding(workflowListMethod, (params) =>
      pageWorkflowSummaries(
        listWorkflowSummaries(engine),
        params.cursor,
        params.limit
      )
    ),
    "workflow/get": defineBinding(workflowGetMethod, (params) => {
      const detail = readNodeWorkflowDetail(engine, params.id)
      if (!detail) {
        throw engineError("not_found", `Workflow not found: ${params.id}`)
      }
      return detail
    }),
  }
}

function pageWorkflowSummaries(
  summaries: WorkflowSummary[],
  cursor?: string,
  limit = DEFAULT_LIST_LIMIT
): { items: WorkflowSummary[]; next?: string } {
  let start = 0
  if (cursor) {
    const at = summaries.findIndex((w) => w.id === cursor)
    start = at === -1 ? 0 : at + 1
  }
  const page = summaries
    .slice(start, start + limit)
    .map((w) => workflowSummarySchema.parse(w))
  const hasMore = start + limit < summaries.length
  const next =
    hasMore && page.length > 0 ? page[page.length - 1]!.id : undefined
  return { items: page, next }
}
