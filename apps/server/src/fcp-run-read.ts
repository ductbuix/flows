import {
  defineBinding,
  engineError,
  type MethodBindings,
} from "@workspace/core"
import {
  runGetMethod,
  runListMethod,
  type RunSummary,
} from "@workspace/contracts"
import type { Engine } from "@workspace/adapters-node"
import { stepsOfRun } from "./run-steps.ts"

const DEFAULT_LIST_LIMIT = 100
/** Cap when walking for cursor pages (local app; REST default is 100). */
const LIST_SCAN_LIMIT = 50_000

export type RunReadBindings = Pick<MethodBindings, "run/list" | "run/get">

export function createRunReadBindings(engine: Engine): RunReadBindings {
  return {
    "run/list": defineBinding(runListMethod, (params) =>
      pageRunSummaries(
        engine.listRunSummaries({
          limit: LIST_SCAN_LIMIT,
          ...(params.workItemId !== undefined
            ? { workItemId: params.workItemId }
            : {}),
          ...(params.workflowId !== undefined
            ? { workflowId: params.workflowId }
            : {}),
        }),
        params.cursor,
        params.limit ?? DEFAULT_LIST_LIMIT
      )
    ),
    "run/get": defineBinding(runGetMethod, (params) => {
      const summary = engine.getRunSummary(params.id)
      if (!summary) {
        throw engineError("not_found", `Run not found: ${params.id}`)
      }
      return { ...summary, steps: stepsOfRun(engine, params.id) }
    }),
  }
}

export function pageRunSummaries(
  items: RunSummary[],
  cursor?: string,
  limit = DEFAULT_LIST_LIMIT
): { items: RunSummary[]; next?: string } {
  let start = 0
  if (cursor) {
    const at = items.findIndex((item) => item.id === cursor)
    start = at === -1 ? 0 : at + 1
  }
  const page = items.slice(start, start + limit)
  const hasMore = start + limit < items.length
  const next =
    hasMore && page.length > 0 ? page[page.length - 1]!.id : undefined
  return { items: page, next }
}
