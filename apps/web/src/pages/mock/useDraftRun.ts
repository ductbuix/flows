import { useCallback } from "react"
import type { MutableRefObject } from "react"
import { wait } from "./flow-node-types"
import type { FlowData, FlowEdge, FlowNode } from "./flow-data"

/** Draft run (mock): each node "runs" for a moment and shows a fake result. */
export function useDraftRun(
  nodes: MutableRefObject<FlowNode[]>,
  edges: MutableRefObject<FlowEdge[]>,
  update: (id: string, patch: Partial<FlowData>) => void
) {
  const run = useCallback(
    async (nid: string) => {
      const n = nodes.current.find((x) => x.id === nid)
      update(nid, { state: "running", result: undefined })
      await wait(900)
      const result =
        n?.type === "llm"
          ? `Mock result from ${n.data.model ?? "model"}. Nothing real runs in the mockup.`
          : n?.type === "condition"
            ? "yes"
            : undefined
      update(nid, { state: "done", result })
    },
    [nodes, update]
  )

  const runAll = useCallback(async () => {
    const order: string[] = []
    const queue = nodes.current.filter((n) => n.type === "trigger").map((n) => n.id)
    while (queue.length) {
      const cur = queue.shift()!
      if (order.includes(cur)) continue
      order.push(cur)
      queue.push(...edges.current.filter((e) => e.source === cur).map((e) => e.target))
    }
    for (const nid of order) await run(nid)
  }, [nodes, edges, run])

  return { run, runAll }
}
