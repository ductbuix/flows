import { createContext, useContext } from "react"
import type { NodeInboxItem } from "./NodeInboxPrompt"
import type { CanvasNodeData } from "./flow-kinds"

/**
 * Actions the node cards call (BL-202: update, settings, duplicate, delete).
 */
export type FlowActions = {
  update: (
    id: string,
    patch: Partial<CanvasNodeData> | Record<string, unknown>
  ) => void
  run: (id: string) => void
  runAll: () => void
  /** Workflow folder id, for node files. */
  workflowId?: string
  /** Viewing a past or live run. */
  readOnly: boolean
  duplicate: (id: string) => void
  openSettings: (id: string) => void
  remove: (id: string) => void
  decide?: (decision: "approved" | "rejected") => void
  /** Retry a failed node on the followed run. */
  retry?: (id: string) => void
  /** Open the log viewer for a node of the followed run. */
  openLogs?: (id: string) => void
  /** Open Inbox asks of the followed run, by node id. */
  inbox?: Readonly<Record<string, NodeInboxItem>>
}

const noop = () => {}

export const FlowContext = createContext<FlowActions>({
  update: noop,
  run: noop,
  runAll: noop,
  readOnly: true,
  duplicate: noop,
  openSettings: noop,
  remove: noop,
})

export const useFlow = () => useContext(FlowContext)
