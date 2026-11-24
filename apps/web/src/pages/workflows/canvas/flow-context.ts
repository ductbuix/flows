import { createContext, useContext } from "react"
import type { CanvasNodeData } from "./flow-kinds"

/**
 * Actions the node cards call. BL-201 wires drag/layout only; BL-202 fills
 * update, add, settings, undo/redo and run.
 */
export type FlowActions = {
  update: (id: string, patch: Partial<CanvasNodeData>) => void
  run: (id: string) => void
  runAll: () => void
  /** Viewing a past run, or editor frame before edit hooks land. */
  readOnly: boolean
  duplicate: (id: string) => void
  openSettings: (id: string) => void
  remove: (id: string) => void
  decide?: (decision: "approved" | "rejected") => void
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
