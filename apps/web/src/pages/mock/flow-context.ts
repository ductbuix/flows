import { createContext, useContext } from "react"
import type { FlowData } from "./flow-data"

export type FlowActions = {
  update: (id: string, patch: Partial<FlowData>) => void
  run: (id: string) => void
  runAll: () => void
  /** Viewing a past run: no Run buttons. */
  readOnly: boolean
  duplicate: (id: string) => void
  openSettings: (id: string) => void
  remove: (id: string) => void
  /** Answers the approval of the run being viewed, if it waits for one. */
  decide?: (decision: "approved" | "rejected") => void
}

export const FlowContext = createContext<FlowActions>({
  update: () => {},
  run: () => {},
  runAll: () => {},
  readOnly: false,
  duplicate: () => {},
  openSettings: () => {},
  remove: () => {},
})

export const useFlow = () => useContext(FlowContext)
